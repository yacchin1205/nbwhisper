"""The NBWebRTC Server"""

import os
from . import (
    server,
)


def load_jupyter_server_extension(nb_server_app):
    nb_server_app.log.info('nbsearch extension started')
    server.register_routes(nb_server_app, nb_server_app.web_app)


# nbextension
def _jupyter_nbextension_paths():
    notebook_ext = dict(section='notebook',
                        src='nbextension',
                        dest='nbwebrtc',
                        require='nbwebrtc/main')
    return [notebook_ext]


# server extension
def _jupyter_server_extension_paths():
    return [dict(module='nbwebrtc')]
