import os

c.NBWebRTC.skyway_api_token = os.environ.get('NBWEBRTC_SKYWAY_API_TOKEN', '')
c.NBWebRTC.room_mode_for_waiting_room = os.environ.get('NBWEBRTC_ROOM_MODE_FOR_WAITING_ROOM', 'sfu')
c.NBWebRTC.room_mode_for_talking_room = os.environ.get('NBWEBRTC_ROOM_MODE_FOR_TALKING_ROOM', 'mesh')
