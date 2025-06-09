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
            Plotly.newPlot('waveHeightAndWindChart', [], {}); // Corrected chart ID
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
    $('#loadingOverlay').show(); // Show loading indicator
    $('#predictBtn').prop('disabled', true); // Disable button during prediction
    $('#currentConditions').hide(); // Hide current conditions until new data
    
    $.get(`/api/predict/${location}?steps=${steps}`, function(data) {
        currentPredictions = data;
        if (currentPredictions.length > 0) {
            plotCharts(currentPredictions);
            showCurrentConditions(currentPredictions[0]); // Show first prediction as current
            $('#currentConditions').show();
        } else {
            alert('No predictions available for this location.');
            // Clear charts if no predictions
            Plotly.newPlot('wavePeriodChart', [], {});
            Plotly.newPlot('waveHeightAndWindChart', [], {});
            Plotly.newPlot('summaryChart', [], {});
        }
    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.error("Prediction API error:", textStatus, errorThrown, jqXHR.responseText);
        alert('Error getting predictions: ' + (jqXHR.responseJSON ? jqXHR.responseJSON.error : 'Unknown error'));
        // Clear charts on error
        Plotly.newPlot('wavePeriodChart', [], {});
        Plotly.newPlot('waveHeightAndWindChart', [], {});
        Plotly.newPlot('summaryChart', [], {});
    }).always(function() {
        $('#loadingOverlay').hide(); // Hide loading indicator
        $('#predictBtn').prop('disabled', false); // Re-enable button
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
        line: { color: '#667eea' }
    };
    const tracePp1d = {
        x: timestamps,
        y: pp1dValues,
        mode: 'lines+markers',
        name: variables['pp1d'],
        line: { color: '#764ba2' }
    };
    const layoutWavePeriod = {
        title: 'Wave Period Predictions (Mean & Peak)',
        xaxis: { title: 'Time' },
        yaxis: { title: 'Period (s)' },
        plot_bgcolor: '#f8f9ff',
        paper_bgcolor: 'white'
    };
    Plotly.newPlot('wavePeriodChart', [traceMwp, tracePp1d], layoutWavePeriod);

    // Chart 2: Wave Height (swh) & Wind Speed (wind) - Corrected chart ID
    const swhValues = predictions.map(p => p.predictions.swh);
    const windValues = predictions.map(p => p.predictions.wind);

    const traceSwh = {
        x: timestamps,
        y: swhValues,
        mode: 'lines+markers',
        name: variables['swh'],
        line: { color: '#48bb78' },
        yaxis: 'y1'
    };
    const traceWind = {
        x: timestamps,
        y: windValues,
        mode: 'lines+markers',
        name: variables['wind'],
        line: { color: '#ed8936' },
        yaxis: 'y2'
    };
    const layoutWaveHeightAndWind = { // Corrected layout name
        title: 'Significant Wave Height & Wind Speed Predictions',
        xaxis: { title: 'Time' },
        yaxis: { title: 'Wave Height (m)', side: 'left', showgrid: false },
        yaxis2: { title: 'Wind Speed (m/s)', side: 'right', overlaying: 'y', showgrid: false },
        plot_bgcolor: '#f8f9ff',
        paper_bgcolor: 'white'
    };
    Plotly.newPlot('waveHeightAndWindChart', [traceSwh, traceWind], layoutWaveHeightAndWind);


    // Chart 3: Summary Bar Chart for current conditions
    plotSummaryChart(predictions);
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
            color: ['#48bb78', '#667eea', '#764ba2', '#ed8936'], // Colors corresponding to swh, mwp, pp1d, wind
            opacity: 0.8
        }
    };

    const layout = {
        title: 'Current Conditions Summary',
        yaxis: {title: 'Value'},
        plot_bgcolor: '#f8f9ff',
        paper_bgcolor: 'white'
    };

    Plotly.newPlot('summaryChart', [trace], layout);
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
