from flask import Flask, render_template, jsonify, request
from aurora_predictor import WavePredictor
import folium
import plotly.graph_objs as go
import plotly.utils
import json
import os
import csv
from flask import Response

app = Flask(__name__)
predictor = WavePredictor()
port = int(os.environ.get("PORT", 7860))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/locations')
def get_locations():
    return jsonify(predictor.locations)

@app.route('/api/variables')
def get_variables():
    # This will return only the 4 selected variables
    return jsonify(predictor.variables)

@app.route('/api/predict_csv/<location>')
def predict_csv(location):
    steps = request.args.get('steps', 8, type=int)
    predictions = predictor.get_predictions(location, steps)
    if predictions is None:
        return jsonify({"error": "Location not found"}), 404

    # Prepare CSV
    def generate():
        header = ['timestamp', 'step'] + list(predictor.variables.keys())
        yield ','.join(header) + '\n'
        for p in predictions:
            row = [p['timestamp'], str(p['step'])] + [str(p['predictions'][k]) for k in predictor.variables.keys()]
            yield ','.join(row) + '\n'
    return Response(generate(), mimetype='text/csv',
                    headers={"Content-Disposition": f"attachment;filename={location}_predictions.csv"})

@app.route('/api/map')
def get_map():
    m = folium.Map(
        location=[5.0, 80.0],
        zoom_start=4,
        tiles='CartoDB positron',
        control_scale=True
    )
    for location, (lat, lon) in predictor.locations.items():
        folium.Marker(
            [lat, lon],
            popup=folium.Popup(f"<b>{location}</b><br><button onclick=\"selectLocation('{location}')\">Select this location</button>", max_width=300),
            tooltip=location,
            icon=folium.Icon(color='blue', icon='info-sign')
        ).add_to(m)
    map_html = m._repr_html_()
    return map_html

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port, debug=True)
