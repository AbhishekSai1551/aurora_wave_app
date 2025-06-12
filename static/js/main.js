let currentPredictions = [];
let locations = {};
let variables = {}; // This will hold the map of var_code to full name (swh: 'Significant Wave Height')

$(document).ready(function() {
    loadInitialData();
    setupEventListeners();
});

function loadInitialData() {
    // Load locations
    $.get('/api/locations', function(data) {
        locations = data;
        updateLocationSelector();
    });

    // Load variables (this will only get the 4 selected variables from the backend)
    $.get('/api/variables', function(data) {
        variables = data;
    });

    // Load map
    loadMap();
}

function setupEventListeners() {
    $('#locationSelect').change(function() {
        const selected = $(this).val();
        $('#predictBtn').prop('disabled', !selected);
        
        if (selected) {
            $('#currentConditions').hide();
            // Clear charts when new location is selected
            Plotly.newPlot('wavePeriodChart', [], {});
            Plotly.newPlot('waveHeightAndWindChart', [], {});
            Plotly.newPlot('summaryChart', [], {});
        }
    });

    $('#stepsSlider').on('input', function() {
        $('#stepsValue').text($(this).val());
    });

    $('#predictBtn').click(function() {
        const location = $('#locationSelect').val();
        const steps = $('#stepsSlider').val();
        
        if (location) {
            getPredictions(location, steps);
        }
    });
    $('#downloadCsvBtn').click(function() {
        const location = $('#locationSelect').val();
        const steps = $('#stepsSlider').val();
        if (location) {
            window.open(`/api/predict_csv/${location}?steps=${steps}`, '_blank');
        }
    });
}

function updateLocationSelector() {
    const select = $('#locationSelect');
    select.empty();
    select.append('<option value="">Select a location...</option>');
    
    Object.keys(locations).forEach(location => {
        select.append(`<option value="${location}">${location}</option>`);
    });
}

function loadMap() {
    $.get('/api/map', function(mapHtml) {
        $('#map-container').html(mapHtml);
    }).fail(function() {
        $('#map-container').html('<div class="error-message">Failed to load map.</div>');
    });
}

function getPredictions(location, steps) {
    // Show loading indicator and disable the prediction button
    $('#loadingOverlay').show();
    $('#predictBtn').prop('disabled', true); // Disable button immediately
    $('#currentConditions').hide(); // Hide current conditions display initially
    
    // Make an AJAX GET request to your Flask backend for predictions
    $.get(`/api/predict/${location}?steps=${steps}`, function(data) {
        currentPredictions = data; // Store the fetched prediction data
        
        if (currentPredictions.length > 0) {
            // If predictions are available, plot the charts and show current conditions
            plotCharts(currentPredictions);
            showCurrentConditions(currentPredictions[0]); 
            $('#currentConditions').show();
            highlightExtremeEvents(currentPredictions);            
            // Show the download CSV button
            $('#downloadCsvBtn').show(); 
        } else {
            // If no predictions are available, alert the user and clear the charts
            alert('No predictions available for this location.');
            Plotly.newPlot('wavePeriodChart', [], {});
            Plotly.newPlot('waveHeightAndWindChart', [], {});
            Plotly.newPlot('summaryChart', [], {});
            
            // Hide the download CSV button
            $('#downloadCsvBtn').hide(); 
        }
    }).fail(function(jqXHR, textStatus, errorThrown) {
        // Handle any errors during the API call
        console.error("Prediction API error:", textStatus, errorThrown, jqXHR.responseText);
        alert('Error getting predictions: ' + (jqXHR.responseJSON ? jqXHR.responseJSON.error : 'Unknown error'));
        
        // Clear charts on error
        Plotly.newPlot('wavePeriodChart', [], {});
        Plotly.newPlot('waveHeightAndWindChart', [], {});
        Plotly.newPlot('summaryChart', [], {});

        // Hide the download CSV button on error
        $('#downloadCsvBtn').hide();
    }).always(function() {
        // This runs regardless of success or failure (both .done() and .fail() calls)
        // Hide the loading indicator
        $('#loadingOverlay').hide(); 
        // Re-enable the prediction button
        $('#predictBtn').prop('disabled', false); 
    });
}

function plotCharts(predictions) {
    const timestamps = predictions.map(p => new Date(p.timestamp));
    
    // Chart 1: Wave Period (mwp & pp1d)
    const mwpValues = predictions.map(p => p.predictions.mwp);
    const pp1dValues = predictions.map(p => p.predictions.pp1d);

    const traceMwp = {
        x: timestamps,
        y: mwpValues,
        mode: 'lines+markers',
        name: variables['mwp'],
        line: { color: '#4A90E2' } // primary-color
    };
    const tracePp1d = {
        x: timestamps,
        y: pp1dValues,
        mode: 'lines+markers',
        name: variables['pp1d'],
        line: { color: '#50B7C6' } // secondary-color
    };
    const layoutWavePeriod = {
        title: 'Wave Period Predictions (Mean & Peak)',
        hovermode: 'x unified',
        xaxis: { title: 'Time', showgrid: true},
        yaxis: { title: 'Period (s)', showgrid: true},
        margin: { t: 50, l: 60, r: 30, b: 50 },
        plot_bgcolor: '#F7F9FC', // var(--bg-light)
        paper_bgcolor: '#FFFFFF', // var(--card-bg)
        font: {
            family: 'Inter, sans-serif',
            color: '#333'
        },
        titlefont: {
            size: 18,
            color: '#333'
        }
    };
    Plotly.newPlot('wavePeriodChart', [traceMwp, tracePp1d], layoutWavePeriod);

    // Chart 2: Wave Height (swh) & Wind Speed (wind)
    const swhValues = predictions.map(p => p.predictions.swh);
    const windValues = predictions.map(p => p.predictions.wind);

    const traceSwh = {
        x: timestamps,
        y: swhValues,
        mode: 'lines+markers',
        name: variables['swh'],
        line: { color: '#FFC107' }, // accent-color
        yaxis: 'y1'
    };
    const traceWind = {
        x: timestamps,
        y: windValues,
        mode: 'lines+markers',
        name: variables['wind'],
        line: { color: '#E91E63' }, // A new color for wind, contrasting with others
        yaxis: 'y2'
    };
    const layoutWaveHeightAndWind = {
        title: 'Significant Wave Height & Wind Speed Predictions',
        hovermode: 'x unified',
        xaxis: { title: 'Time', showgrid: true },
        yaxis: { title: 'Wave Height (m)', side: 'left', showgrid: true, zeroline: false },
        yaxis2: { title: 'Wind Speed (m/s)', side: 'right', overlaying: 'y', showgrid: false, zeroline: false },
        margin: { t: 50, l: 60, r: 60, b: 50 },
        plot_bgcolor: '#F7F9FC',
        paper_bgcolor: '#FFFFFF',
        font: {
            family: 'Inter, sans-serif',
            color: '#333'
        },
        titlefont: {
            size: 18,
            color: '#333'
        }
    };
    Plotly.newPlot('waveHeightAndWindChart', [traceSwh, traceWind], layoutWaveHeightAndWind);


    // Chart 3: Summary Bar Chart for current conditions
    plotSummaryChart(predictions);
    plotWindRose(predictions);
    plotWaveHeightAnimation(predictions);
}

function plotSummaryChart(currentPredictions) {
    if (!currentPredictions || currentPredictions.length === 0) {
        Plotly.newPlot('summaryChart', [], {});
        return;
    }

    // Use only the 4 variables we care about
    const variablesForSummary = ['swh', 'mwp', 'pp1d', 'wind'];
    
    const currentValues = variablesForSummary.map(v => 
        currentPredictions[0].predictions[v]
    );
    
    // Adjust display names for the summary chart if needed, otherwise use `variables` map
    const displayNames = variablesForSummary.map(v => variables[v]);

    const trace = {
        x: displayNames,
        y: currentValues,
        type: 'bar',
        marker: {
            color: ['#FFC107', '#4A90E2', '#50B7C6', '#E91E63'], // Colors corresponding to swh, mwp, pp1d, wind matching new palette
            opacity: 0.8
        }
    };

    const layout = {
        title: 'Current Conditions Summary',
        yaxis: {title: 'Value', zeroline: false},
        hovermode: 'closest',
        margin: { t: 50, l: 60, r: 30, b: 50 },
        plot_bgcolor: '#F7F9FC',
        paper_bgcolor: '#FFFFFF',
        font: {
            family: 'Inter, sans-serif',
            color: '#333'
        },
        titlefont: {
            size: 18,
            color: '#333'
        }
    };

    Plotly.newPlot('summaryChart', [trace], layout);
}

function plotWaveHeightHeatmap() {
    // Fetch current SWH for all locations
    $.when(
        $.get('/api/locations'),
        $.get('/api/variables')
    ).done(function(locData, varData) {
        const locs = locData[0];
        const varCodes = varData[0];
        const promises = Object.keys(locs).map(loc =>
            $.get(`/api/predict/${loc}?steps=1`).then(data => ({
                location: loc,
                lat: locs[loc][0],
                lon: locs[loc][1],
                swh: data.length > 0 ? data[0].predictions.swh : null
            }))
        );
        Promise.all(promises).then(results => {
            const lats = results.map(r => r.lat);
            const lons = results.map(r => r.lon);
            const swhs = results.map(r => r.swh);

            const trace = {
                type: 'scattergeo',
                mode: 'markers',
                lat: lats,
                lon: lons,
                text: results.map(r => `${r.location}: ${r.swh} m`),
                marker: {
                    size: 18,
                    color: swhs,
                    colorscale: 'YlGnBu',
                    colorbar: { title: 'SWH (m)' }
                }
            };
            const layout = {
                geo: {
                    scope: 'world',
                    projection: { type: 'natural earth' },
                    showland: true,
                    landcolor: '#F7F9FC'
                },
                margin: { t: 30, l: 0, r: 0, b: 0 }
            };
            Plotly.newPlot('waveHeightHeatmap', [trace], layout);
        });
    });
}
// Call this after page load
$(document).ready(function() {
    plotWaveHeightHeatmap();
});

function plotWindRose(predictions) {
    // For demo: use random wind direction if not available
    const windSpeeds = predictions.map(p => p.predictions.wind);
    const windDirs = predictions.map(p => p.predictions.wind_dir || Math.floor(Math.random() * 360));

    const trace = {
        type: 'barpolar',
        r: windSpeeds,
        theta: windDirs,
        name: 'Wind Speed',
        marker: {
            color: windSpeeds,
            colorscale: 'Blues',
            line: { color: '#333' }
        }
    };
    const layout = {
        title: 'Wind Rose',
        polar: {
            radialaxis: { ticksuffix: ' m/s', angle: 45, dtick: 2 },
            angularaxis: { direction: "clockwise" }
        },
        margin: { t: 50, l: 30, r: 30, b: 30 },
        plot_bgcolor: '#F7F9FC',
        paper_bgcolor: '#FFFFFF',
        font: { family: 'Inter, sans-serif', color: '#333' }
    };
    Plotly.newPlot('windRoseChart', [trace], layout);
}

function plotWaveHeightAnimation(predictions) {
    const timestamps = predictions.map(p => new Date(p.timestamp));
    const swhValues = predictions.map(p => p.predictions.swh);

    const trace = {
        x: timestamps,
        y: swhValues,
        mode: 'lines+markers',
        name: variables['swh'],
        line: { color: '#FFC107' }
    };

    const frames = swhValues.map((swh, i) => ({
        name: i,
        data: [{
            x: timestamps.slice(0, i + 1),
            y: swhValues.slice(0, i + 1),
            mode: 'lines+markers',
            line: { color: '#FFC107' }
        }]
    }));

    const layout = {
        title: 'Wave Height Forecast Animation',
        xaxis: { title: 'Time' },
        yaxis: { title: 'Wave Height (m)' },
        updatemenus: [{
            type: 'buttons',
            showactive: false,
            buttons: [{
                label: 'Play',
                method: 'animate',
                args: [null, { fromcurrent: true, frame: { duration: 500, redraw: true }, transition: { duration: 0 } }]
            }]
        }],
        plot_bgcolor: '#F7F9FC',
        paper_bgcolor: '#FFFFFF',
        font: { family: 'Inter, sans-serif', color: '#333' }
    };

    Plotly.newPlot('waveHeightAnimation', [trace], layout).then(function() {
        Plotly.addFrames('waveHeightAnimation', frames);
    });
}

function highlightExtremeEvents(predictions) {
    const extremeSWH = predictions.filter(p => p.predictions.swh > 3);
    const extremeWind = predictions.filter(p => p.predictions.wind > 10);

    let html = '';
    if (extremeSWH.length > 0) {
        html += `<div class="error-message">⚠️ High Wave Height (&gt;3m) at: ${extremeSWH.map(p => new Date(p.timestamp).toLocaleString()).join(', ')}</div>`;
    }
    if (extremeWind.length > 0) {
        html += `<div class="error-message">⚠️ High Wind Speed (&gt;10 m/s) at: ${extremeWind.map(p => new Date(p.timestamp).toLocaleString()).join(', ')}</div>`;
    }
    $('#currentConditions').prepend(html);
}

function showCurrentConditions(firstPrediction) {
    const conditions = firstPrediction.predictions;
    
    // Generate HTML for only the 4 selected variables
    const html = `
        <div class="condition-item">
            <strong>${variables.swh}</strong><br>
            ${conditions.swh} meters
        </div>
        <div class="condition-item">
            <strong>${variables.mwp}</strong><br>
            ${conditions.mwp} seconds
        </div>
        <div class="condition-item">
            <strong>${variables.pp1d}</strong><br>
            ${conditions.pp1d} seconds
        </div>
        <div class="condition-item">
            <strong>${variables.wind}</strong><br>
            ${conditions.wind} m/s
        </div>
    `;
    $('#conditionsData').html(html);
}

function selectLocation(locationName) {
    $('#locationSelect').val(locationName).trigger('change');
}
window.selectLocation = selectLocation;
