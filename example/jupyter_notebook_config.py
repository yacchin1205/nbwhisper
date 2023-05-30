import os

c.NBWhisper.skyway_api_token = os.environ.get('NBWHISPER_SKYWAY_API_TOKEN', '')
c.NBWhisper.room_mode_for_waiting_room = os.environ.get('NBWHISPER_ROOM_MODE_FOR_WAITING_ROOM', 'sfu')
c.NBWhisper.room_mode_for_talking_room = os.environ.get('NBWHISPER_ROOM_MODE_FOR_TALKING_ROOM', 'mesh')
