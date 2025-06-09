#!/bin/bash

echo "--- RunPod: Starting pod_init.sh ---"

# Ensure Python is available
if ! command -v python3 &> /dev/null
then
    echo "ERROR: Python3 not found. Please ensure Python3 is installed in your base image."
    exit 1
fi

# Run the Python setup script to install dependencies
echo "--- RunPod: Executing runpod_setup.py ---"
python3 runpod_setup.py

# Check if the setup script ran successfully
if [ $? -ne 0 ]; then
    echo "--- ERROR: runpod_setup.py failed. Exiting pod initialization. ---"
    exit 1
fi

echo "--- RunPod: Starting Flask application with Gunicorn ---"
# Use Gunicorn to serve the Flask application.
# `app:app` means the Flask app instance named 'app' inside the 'app.py' file.
# The port is read from the environment variable PORT, defaulting to 7860.
# 0.0.0.0 binds to all available network interfaces.
exec gunicorn --bind 0.0.0.0:${PORT:-7860} app:app

echo "--- RunPod: Application started (or attempted to start) ---"

# Note: The `exec` command replaces the shell process with gunicorn,
# so any commands after `exec` will only run if gunicorn fails to start.