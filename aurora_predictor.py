import torch
import numpy as np
from datetime import datetime, timedelta

# --- REAL AURORA IMPORTS ---
# These imports require the 'microsoft-aurora' library to be installed.
# If you run this script without the library, it will fail.
try:
    from aurora import AuroraWave, Batch, Metadata, rollout
    print("Successfully imported AuroraWave, Batch, Metadata, rollout from 'aurora' library.")
    AURORA_AVAILABLE = True
except ImportError:
    print("WARNING: 'microsoft-aurora' library not found. Falling back to random predictions.")
    print("Please ensure 'microsoft-aurora' is installed via pip and your environment is set up correctly.")
    AURORA_AVAILABLE = False
except Exception as e:
    print(f"WARNING: Error importing Aurora components: {e}. Falling back to random predictions.")
    AURORA_AVAILABLE = False


class WavePredictor:
    def __init__(self):
        self.model = None
        self.model_loaded = False
        self.device = "cpu" # Default to CPU

        if AURORA_AVAILABLE:
            try:
                print("Attempting to load AuroraWave model (real). This may take some time for download.")
                self.model = AuroraWave()
                # Load a specific checkpoint from Hugging Face.
                # 'aurora-0.25-small-pretrained.ckpt' is a publicly available checkpoint.
                self.model.load_checkpoint("microsoft/aurora", "aurora-0.25-small-pretrained.ckpt")
                self.model.eval() # Set model to evaluation mode

                if torch.cuda.is_available():
                    self.device = "cuda"
                    self.model.to(self.device)
                    print(f"AuroraWave model loaded successfully on {self.device}.")
                else:
                    print("CUDA not available. AuroraWave model will run on CPU, which is very slow and memory-intensive.")
                    print("Consider using a GPU-enabled environment (e.g., RunPod with a GPU instance).")
                self.model_loaded = True
            except Exception as e:
                print(f"ERROR: Failed to load real AuroraWave model: {e}")
                print("Predictions will be entirely random as the actual Aurora model could not be loaded.")
                self.model = None
                self.model_loaded = False
        else:
            print("Aurora library not available. Predictions will be entirely random.")

        # Coastal locations similar to Maldives
        self.locations = {
            "Maldives": (4.1755, 73.5093),
            "Phu Quoc, Vietnam": (10.227, 103.963),
            "Con Dao, Vietnam": (8.6833, 106.5833),
            "Andaman Islands": (12.000, 92.900),
            "Nicobar Islands": (7.000, 93.700),
            "Lakshadweep": (10.5667, 72.6167),
            "Palawan, Philippines": (9.8349, 118.7384),
            "Koh Phi Phi, Thailand": (7.7407, 98.7784),
            "Seychelles": (-4.6796, 55.4919),
            "Zanzibar, Tanzania": (-6.1659, 39.2026)
        }

        # --- Your selected variables for display and extraction from model output ---
        # ONLY these 4 variables will be returned to the frontend.
        self.variables = {
            "swh": "Significant Wave Height",
            "mwp": "Mean Wave Period",
            "pp1d": "Peak Wave Period",
            "wind": "Wind Speed"
        }

        # Define grid dimensions for the batch.
        self.GRID_DIM = 1
        self.HISTORY_LENGTH = 2 # Aurora models typically need current and previous step data
        self.ATMOS_LEVELS = (1000, 850, 500, 200) # Example pressure levels (hPa) - from Batch doc

    def create_wave_batch(self, lat, lon):
        """
        Creates an Aurora Batch object with mock data, structured for the real AuroraWave model.
        
        This function generates random data for ALL variables typically required by the
        Aurora Wave model as input (based on 'Available Models' PDF, Page 9).
        In a real-world application, you would replace `torch.randn` with actual
        meteorological and oceanographic data sourced from providers like Copernicus CDS, NOAA, etc.
        """
        batch_size = 1 # We are predicting for a single location at a time

        # All Surface-level variables required by Aurora 0.25 Wave (from 'Available Models' PDF)
        surf_vars = {
            "mwd": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mwp": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "pp1d": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "shww": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mdww": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mpww": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "shts": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "2t": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "10u": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "10v": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "swh": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mdts": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mpts": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "swh1": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mwd1": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mwp1": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "swh2": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mwd2": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "mwp2": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "10u_wave": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "10v_wave": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "wind": torch.randn(batch_size, self.HISTORY_LENGTH, self.GRID_DIM, self.GRID_DIM).to(self.device)
        }

        # Static variables required by Aurora 0.25 Wave (from 'Available Models' PDF)
        static_vars = {
            "lsm": torch.randn(batch_size, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "slt": torch.randn(batch_size, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "z": torch.randn(batch_size, self.GRID_DIM, self.GRID_DIM).to(self.device),
            "wmb": torch.randn(batch_size, self.GRID_DIM, self.GRID_DIM).to(self.device), # Water body mask
            "lat_mask": torch.randn(batch_size, self.GRID_DIM, self.GRID_DIM).to(self.device) # Latitude mask
        }
        
        # Atmospheric variables required by Aurora 0.25 Wave (from 'Available Models' PDF)
        # Note: These need to match self.ATMOS_LEVELS
        atmos_vars = {
            "t": torch.randn(batch_size, self.HISTORY_LENGTH, len(self.ATMOS_LEVELS), self.GRID_DIM, self.GRID_DIM).to(self.device),
            "q": torch.randn(batch_size, self.HISTORY_LENGTH, len(self.ATMOS_LEVELS), self.GRID_DIM, self.GRID_DIM).to(self.device),
            "z": torch.randn(batch_size, self.HISTORY_LENGTH, len(self.ATMOS_LEVELS), self.GRID_DIM, self.GRID_DIM).to(self.device)
        }

        # Metadata for the batch
        lat_grid = torch.tensor([lat], dtype=torch.float32).to(self.device)
        # Longitudes must be in the range [0, 360) for Aurora
        lon_grid = torch.tensor([lon % 360], dtype=torch.float32).to(self.device)

        current_time = datetime.now()
        previous_time = current_time - timedelta(hours=6) # Aurora expects history for current and previous step

        metadata = Metadata(
            lat=lat_grid,
            lon=lon_grid,
            atmos_levels=self.ATMOS_LEVELS,
            time=(previous_time, current_time)
        )

        return Batch(
            surf_vars=surf_vars,
            static_vars=static_vars,
            atmos_vars=atmos_vars,
            metadata=metadata
        )

    def get_predictions(self, location_name, steps=8):
        if location_name not in self.locations:
            return None

        # If model is not loaded (due to import error, loading error, or no GPU),
        # generate purely random data for demonstration.
        if not self.model_loaded:
            print(f"Model not loaded. Generating random data for {location_name}.")
            predictions_data = []
            for step in range(steps):
                step_data = {
                    "timestamp": (datetime.now() + timedelta(hours=6 * (step + 1))).isoformat(),
                    "step": step + 1,
                    "predictions": {}
                }
                for var_code in self.variables.keys(): # ONLY your 4 selected variables for output
                    # Generate random values within "realistic" bounds for demo
                    value = np.random.rand()
                    if var_code == "swh":
                        value = np.random.uniform(0.5, 5.0) # Significant Wave Height 0.5-5.0 meters
                    elif var_code in ["mwp", "pp1d"]:
                        value = np.random.uniform(3.0, 15.0) # Wave periods 3-15 seconds
                    elif var_code == "wind":
                        value = np.random.uniform(0.0, 25.0) # Wind speed 0-25 m/s

                    step_data["predictions"][var_code] = round(value, 2)
                predictions_data.append(step_data)
            return predictions_data

        # --- If the real model is loaded, proceed with batch creation and prediction ---
        lat, lon = self.locations[location_name]
        initial_batch = self.create_wave_batch(lat, lon) # This batch contains random input data!

        print(f"Running Aurora rollout for {location_name} for {steps} steps...")
        predictions_batches = []
        try:
            with torch.inference_mode(): # Disable gradient calculations for inference
                # The real rollout function handles the autoregressive steps internally
                predictions_batches = rollout(self.model, initial_batch, steps=steps)
            print("Aurora rollout completed.")
        except Exception as e:
            print(f"ERROR during Aurora rollout: {e}")
            print("Returning empty predictions due to model error.")
            return [] # Return empty list on error

        predictions_data = []
        for step_idx, pred_batch in enumerate(predictions_batches):
            # Move the prediction batch to CPU for processing and potential serialization
            # This is important to free up GPU memory if you are doing many rollouts
            pred_batch_cpu = pred_batch.to("cpu")

            # Extract center point (assuming single point prediction in batch, or take first)
            center_idx = 0

            step_data = {
                "timestamp": pred_batch_cpu.metadata.time[-1].isoformat(), # Last timestamp in metadata tuple
                "step": step_idx + 1,
                "predictions": {}
            }

            # Extract predictions ONLY for your 4 selected variables from the real pred_batch
            for var_code in self.variables.keys(): # ONLY your 4 selected variables for output
                # Access the predicted value. `[0, 0, center_idx, center_idx]` means:
                # `[batch_item_0, history_step_0 (the predicted one), lat_idx, lon_idx]`
                value = pred_batch_cpu.surf_vars[var_code][0, 0, center_idx, center_idx].item()

                # Apply realistic range clamping (can be removed if model output is always within bounds)
                if var_code == "swh":
                    value = max(0.1, min(10.0, value))  # Significant Wave Height 0.1-10.0m
                elif var_code in ["mwp", "pp1d"]:
                    value = max(1.0, min(25.0, value))   # Wave periods 1-25s
                elif var_code == "wind":
                    value = max(0.0, min(30.0, value))   # Wind speed 0-30 m/s

                step_data["predictions"][var_code] = round(value, 2)

            predictions_data.append(step_data)

        return predictions_data