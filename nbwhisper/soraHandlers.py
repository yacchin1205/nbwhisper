# Sora Cloud APIを呼び出すためのHandler
from jupyter_server.base.handlers import APIHandler
import tornado, aiohttp, json, datetime

class CreateAccessTokenHandler(APIHandler):
    def initialize(self, config):
        self._config = config

    @tornado.web.authenticated
    async def get(self):
        headers = {
            "Authorization": "Bearer " + self._config.api_key,
            "Content-Type": "application/json"
        }

        params = {
            "channel_id": self.get_query_argument("channel_id", ""),
            "role": "sendrecv",
            "max_channel_connections": 1000, # 0 ~ 5000
            "expiration_time": (datetime.datetime.now() + datetime.timedelta(seconds=30)).astimezone().isoformat(timespec='seconds') # expired after 30s
        }

        url = "https://api.sora-cloud.shiguredo.app/projects/create-access-token"

        status = -1
        response_text = ""
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, params=params) as response:
                status = response.status
                if(response.status == 200):
                    response_text = await response.text()            
        self.finish(json.dumps({
            "status": status,
            "text": response_text
        }))

class PushChannelHandler(APIHandler):
    def initialize(self, config):
        self._config = config

    @tornado.web.authenticated
    async def get(self):
        headers = {
            "Authorization": "Bearer " + self._config.api_key,
            "x-sora-target": "Sora_20160711.PushChannel",
            "Content-Type": "application/json"
        }

        params = {
            "channel_id": self.get_query_argument("channel_id", ""),
            "data": json.loads(self.get_query_argument("data", "{}"))
        }

        url = "https://api.sora-cloud.shiguredo.app/sora-api"

        status = -1
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=params) as response:
                status = response.status     
        self.finish(json.dumps({
            "status": status
        }))