from traitlets import Unicode
from traitlets.config.configurable import Configurable


class NBWhisper(Configurable):

    skyway_api_token = Unicode(
        '',
        help='An api token for SkyWay(*for old SkyWay). You need to use the same api key in your team. Please see SkyWay: https://console-webrtc-free.ecl.ntt.com/users/login',
    ).tag(config=True)

    room_mode_for_waiting_room = Unicode(
        'sfu',
        help='Room mode for waiting room. You can input "sfu" or "mesh". You need to use the same mode in your team.',
    ).tag(config=True)

    room_mode_for_talking_room = Unicode(
        'mesh',
        help='Room mode for talking room. You can input "sfu" or "mesh". You need to use the same mode in your team.',
    ).tag(config=True)

    default_username = Unicode('jovyan', help='Default Username').tag(config=True)
