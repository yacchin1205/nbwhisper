from traitlets import Unicode, Bool
from traitlets.config.configurable import Configurable

class NBWhisper(Configurable):
    signaling_url = Unicode(
        'signaling_url',
        help='signaling_url',
    ).tag(config=True)

    api_key = Unicode(
        'api_key',
        help='api_key',
    ).tag(config=True)

    channel_id_prefix = Unicode(
        'channel_id_prefix',
        help='channel_id_prefix'
    ).tag(config=True)

    channel_id_suffix = Unicode(
        'channel_id_suffix',
        help='channel_id_suffix'
    ).tag(config=True)

    default_username = Unicode(
        'jovyan', 
        help='Default Username'
    ).tag(config=True)

    share_current_tab_only = Bool(
        True,
        help='share_current_tab_only',
    ).tag(config=True)

    create_access_token_type = Unicode(
        'sora-cloud',
        help='create_access_token_type'
    ).tag(config=True)

    create_access_token_url = Unicode(
        '',
        help='create_access_token_url'
    ).tag(config=True)

    push_channel_type = Unicode(
        'sora-cloud',
        help='push_channel_type'
    ).tag(config=True)

    push_channel_url = Unicode(
        '',
        help='push_channel_url'
    ).tag(config=True)

    change_spotlight_rid_url = Unicode(
        '',
        help='change_spotlight_rid_url'
    ).tag(config=True)
    