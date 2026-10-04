"""
AEGIS AI Vision Dashboard - Streamlit Frontend
Real-time monitoring of ESP32-CAM helmet detection system.
"""
import streamlit as st
import requests
import websocket
import json
import base64
import threading
import time
from PIL import Image
from io import BytesIO
from datetime import datetime

# Page config
st.set_page_config(
    page_title="AEGIS AI Vision",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: 900;
        color: #FF6B35;
        text-align: center;
        margin-bottom: 1rem;
    }
    .status-card {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 16px;
        padding: 1.5rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .alert-critical {
        background: rgba(255, 0, 0, 0.1);
        border-left: 4px solid #FF0000;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
    }
    .alert-high {
        background: rgba(255, 107, 53, 0.1);
        border-left: 4px solid #FF6B35;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
    }
    .alert-medium {
        background: rgba(255, 193, 7, 0.1);
        border-left: 4px solid #FFC107;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
    }
    .metric-value {
        font-size: 2rem;
        font-weight: 900;
        color: #FF6B35;
    }
    .metric-label {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'ws_connected' not in st.session_state:
    st.session_state.ws_connected = False
if 'alerts' not in st.session_state:
    st.session_state.alerts = []
if 'stream_active' not in st.session_state:
    st.session_state.stream_active = False


def connect_websocket():
    """Connect to WebSocket for live stream."""
    try:
        ws = websocket.create_connection("ws://localhost:8000/ws/stream")
        st.session_state.ws_connected = True
        return ws
    except Exception as e:
        st.error(f"WebSocket connection failed: {e}")
        return None


def disconnect_websocket():
    """Disconnect WebSocket."""
    st.session_state.ws_connected = False


def start_stream(url: str):
    """Start ESP32-CAM stream."""
    try:
        response = requests.post(
            "http://localhost:8000/stream/start",
            json={"url": url, "fps": 30}
        )
        if response.status_code == 200:
            st.session_state.stream_active = True
            st.success("Stream started successfully!")
        else:
            st.error(f"Failed to start stream: {response.text}")
    except Exception as e:
        st.error(f"Error starting stream: {e}")


def stop_stream():
    """Stop ESP32-CAM stream."""
    try:
        response = requests.post("http://localhost:8000/stream/stop")
        if response.status_code == 200:
            st.session_state.stream_active = False
            st.success("Stream stopped!")
    except Exception as e:
        st.error(f"Error stopping stream: {e}")


def get_stream_status():
    """Get current stream status."""
    try:
        response = requests.get("http://localhost:8000/stream/status")
        return response.json()
    except:
        return {"active": False}


def main():
    # Header
    st.markdown('<h1 class="main-header">🛡️ AEGIS AI VISION</h1>', unsafe_allow_html=True)
    st.markdown('<p style="text-align: center; color: rgba(255,255,255,0.5);">ESP32-CAM Helmet Detection System</p>', unsafe_allow_html=True)

    # Sidebar
    with st.sidebar:
        st.markdown("### 🎛️ Control Panel")

        # Stream URL input
        stream_url = st.text_input(
            "ESP32-CAM Stream URL",
            value="http://192.168.4.1:81/stream",
            help="Enter the MJPEG stream URL from your ESP32-CAM"
        )

        # Stream controls
        col1, col2 = st.columns(2)
        with col1:
            if st.button("▶️ Start Stream", use_container_width=True):
                start_stream(stream_url)
        with col2:
            if st.button("⏹️ Stop Stream", use_container_width=True):
                stop_stream()

        st.markdown("---")

        # WebSocket controls
        st.markdown("### 📡 Live Feed")
        if not st.session_state.ws_connected:
            if st.button("🔌 Connect WebSocket", use_container_width=True):
                ws = connect_websocket()
                if ws:
                    st.rerun()
        else:
            st.success("✅ WebSocket Connected")
            if st.button("🔌 Disconnect", use_container_width=True):
                disconnect_websocket()
                st.rerun()

        st.markdown("---")

        # Status
        st.markdown("### 📊 Status")
        status = get_stream_status()
        st.json(status)

    # Main content
    col1, col2 = st.columns([2, 1])

    with col1:
        # Live stream display
        st.markdown("### 📹 Live Stream")

        if st.session_state.ws_connected:
            # Create placeholder for stream
            stream_placeholder = st.empty()

            try:
                ws = websocket.create_connection("ws://localhost:8000/ws/stream")

                while st.session_state.ws_connected:
                    try:
                        message = ws.recv()
                        data = json.loads(message)

                        if data.get("type") == "frame":
                            # Decode base64 image
                            img_data = base64.b64decode(data["data"])
                            img = Image.open(BytesIO(img_data))
                            stream_placeholder.image(img, use_column_width=True)
                    except websocket.WebSocketTimeoutException:
                        continue
                    except Exception as e:
                        st.error(f"Stream error: {e}")
                        break

                ws.close()
            except Exception as e:
                st.error(f"WebSocket error: {e}")
        else:
            st.info("Connect WebSocket to view live stream")

    with col2:
        # Alerts panel
        st.markdown("### 🚨 Alerts")

        # Fetch alerts
        try:
            response = requests.get("http://localhost:8000/api/detections")
            if response.status_code == 200:
                data = response.json()
                alerts = data.get("alerts", [])

                if alerts:
                    for alert in alerts:
                        if alert["severity"] == "critical":
                            st.markdown(f'<div class="alert-critical">🚨 {alert["message"]}</div>', unsafe_allow_html=True)
                        elif alert["severity"] == "high":
                            st.markdown(f'<div class="alert-high">⚠️ {alert["message"]}</div>', unsafe_allow_html=True)
                        else:
                            st.markdown(f'<div class="alert-medium">ℹ️ {alert["message"]}</div>', unsafe_allow_html=True)
                else:
                    st.info("No active alerts")
        except Exception as e:
            st.error(f"Error fetching alerts: {e}")

        st.markdown("---")

        # Statistics
        st.markdown("### 📈 Statistics")
        try:
            response = requests.get("http://localhost:8000/api/detections")
            if response.status_code == 200:
                data = response.json()
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Persons", data.get("persons", 0))
                with col2:
                    st.metric("Vehicles", data.get("vehicles", 0))
                with col3:
                    st.metric("Alerts", len(data.get("alerts", [])))
        except:
            st.info("Connect to backend for statistics")


if __name__ == "__main__":
    main()
