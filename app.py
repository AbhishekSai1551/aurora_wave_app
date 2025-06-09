from flask import Flask, render_template, jsonify, request
from aurora_predictor import WavePredictor
import folium
import plotly.graph_objs as go
import plotly.utils
import json
import os

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

@app.route('/api/predict/<location>')
def predict(location):
    steps = request.args.get('steps', 8, type=int)
    predictions = predictor.get_predictions(location, steps)
    
    if predictions is None:
        return jsonify({"error": "Location not found"}), 404
    
    return jsonify(predictions)

@app.route('/api/map')
def get_map():
    # Create map centered on Indian Ocean
    m = folium.Map(
        location=[5.0, 80.0],
        zoom_start=4,
        tiles='OpenStreetMap'
    )
    
    # Add markers for each location
    for location, (lat, lon) in predictor.locations.items():
        folium.Marker(
            [lat, lon],
            popup=f"<b>{location}</b><br>Click for wave predictions",
            tooltip=location,
            # Removed emoji, using 'info-sign' as a standard icon from Font Awesome (often available in Folium's default icon set)
            icon=folium.Icon(color='blue', icon='info-sign') 
        ).add_to(m)

    # Convert map to HTML string
    map_html = m._repr_html_()
    return map_html

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port, debug=True)
