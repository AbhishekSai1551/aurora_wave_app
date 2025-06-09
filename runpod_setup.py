import subprocess
import sys
import os

def install_dependencies():
    """Installs Python dependencies listed in requirements.txt."""
    print("--- Starting RunPod Setup: Installing Python dependencies ---")
    try:
        # Ensure pip is up-to-date (optional but good practice)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "pip"]) 
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("--- Dependencies installed successfully ---")
    except subprocess.CalledProcessError as e:
        print(f"--- ERROR: Failed to install dependencies: {e} ---")
        sys.exit(1)
    except FileNotFoundError:
        print("--- ERROR: 'pip' command not found. Ensure Python and pip are correctly installed. ---")
        sys.exit(1)

def main():
    """Main function to run setup tasks."""
    install_dependencies()
    # Add any other setup steps here, e.g., downloading specific model files
    # if they are not handled directly by the 'microsoft-aurora' library's checkpoint loading.
    print("--- RunPod setup script finished ---")

if __name__ == "__main__":
    main()