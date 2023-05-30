import os

from tornado import gen

from .v1.handlers import (
    ConfigHandler
)
from .config import NBWhisper


def get_api_handlers(parent_app, base_dir):
    config = NBWhisper(parent=parent_app)
    handler_settings = {}
    handler_settings['config'] = config

    return [
        (r"/v1/config", ConfigHandler, handler_settings),
    ]

def register_routes(nb_server_app, web_app):
    from notebook.utils import url_path_join
    api_handlers = get_api_handlers(nb_server_app, nb_server_app.notebook_dir)

    host_pattern = '.*$'
    handlers = [(url_path_join(web_app.settings['base_url'], 'nbwhisper', path),
                 handler,
                 options)
                for path, handler, options in api_handlers]
    web_app.add_handlers(host_pattern, handlers)
