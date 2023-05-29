from datetime import datetime
import os
from stat import S_IREAD

from tornado import web
from jupyter_server.base.handlers import JupyterHandler


class ConfigHandler(JupyterHandler):
    def initialize(self, config):
        self._config = config

    @web.authenticated
    async def get(self):
        username = self._config.default_username
        if 'JUPYTERHUB_USER' in os.environ:
            username = os.environ['JUPYTERHUB_USER']
        self.finish({
            'username': username,
            'skyway_api_token': self._config.skyway_api_token,
            'room_mode_for_waiting_room': self._config.room_mode_for_waiting_room,
            'room_mode_for_talking_room': self._config.room_mode_for_talking_room,
        })
