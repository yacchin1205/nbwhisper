# Sora Cloud APIを呼び出すためのHandler
from jupyter_server.base.handlers import APIHandler
import tornado, aiohttp, json, datetime

class CreateAccessTokenHandler(APIHandler):
    def initialize(self, config):
        self._config = config

    @tornado.web.authenticated
    async def get(self):
        channel_id = self.get_query_argument("channel_id", "")
        if (channel_id == ""):
            self.set_status(400)
            self.finish(json.dumps({
                "status": 400,
                "message": "Missing channel_id"
            }))
            return
        create_access_token_type = self._config.create_access_token_type
        api_key = self._config.api_key
        if (create_access_token_type == "sora-cloud"):
            await self.fetch_sora_cloud_access_token(api_key, channel_id)
            return
        user_display_name = self.get_query_argument("user_display_name", "")
        if (user_display_name == ""):
            self.set_status(400)
            self.finish(json.dumps({
                "status": 400,
                "message": "Missing user_display_name"
            }))
            return
        if (create_access_token_type != "meeting.dev"):
            self.set_status(500)
            self.finish(json.dumps({
                "status": 500,
                "message": "Invalid create_access_token_type"
            }))
            return
        await self.fetch_meeting_dev_access_token(api_key, channel_id, user_display_name)
        
    async def fetch_sora_cloud_access_token(self, api_key, channel_id):
        headers = {
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json"
        }

        data = {
            "channel_id": channel_id,
            "role": "sendrecv",
            "max_channel_connections": 1000, # 0 ~ 5000
            "expiration_time": (datetime.datetime.now() + datetime.timedelta(seconds=30)).astimezone().isoformat(timespec='seconds') # expired after 30s
        }

        url = "https://api.sora-cloud.shiguredo.app/projects/create-access-token"

        status = -1
        response_text = ""
        async with aiohttp.ClientSession() as session:
            # if not set parameter as params, get wrong access token
            async with session.post(url, headers=headers, params=data) as response:
                status = response.status
                if(response.status == 200):
                    response = await response.json()
                    if(response is not None and isinstance(response, dict)):
                      access_token = response.get("access_token")
                      if(access_token is not None):
                        fixed_response = {
                            "metadata": {
                                "access_token": access_token
                            }
                        }
                        response_text = json.dumps(fixed_response)
        
        self.set_status(status)
        self.finish(json.dumps({
            "status": status,
            "text": response_text
        }))

    async def fetch_meeting_dev_access_token(self, api_key, channel_id, user_display_name):
        url = self._config.create_access_token_url
        if(url == ""):
            self.set_status(500)
            self.finish(json.dumps({
                "status": 500,
                "message": "create_access_token_url is not set"
            }))
            return
        headers = {
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/x-www-form-urlencoded"
        }

        data = {
            "channel_name": channel_id,
            "user_display_name": user_display_name,
        }

        status = -1
        response_text = ""
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, data=data) as response:
                status = response.status
                if(response.status == 200):
                    response = await response.json()
                    if(response is not None and isinstance(response, dict)):
                        fixed_response = {
                            "metadata": {
                                **response,
                                "is_screen_share": False,
                                "user_agent": 'nbwhisper',
                                "recv_only": False,
                                "has_camera_device": True,
                                "camera_label": '',
                                "has_mic_device": True,
                                "mic_label": '',
                            },
                            "signaling_notify_metadata": {
                                "display_name": user_display_name,
                                "is_screen_share": False,
                                "mute_audio": False,
                                "mute_video": False,
                                "photo": '',
                                "recvonly": False,
                                "user_id": 0,
                            }
                        }
                        response_text = json.dumps(fixed_response)
        
        self.set_status(status)
        self.finish(json.dumps({
            "status": status,
            "text": response_text
        }))

class PushChannelHandler(APIHandler):
    def initialize(self, config):
        self._config = config

    @tornado.web.authenticated
    async def get(self):
        channel_id = self.get_query_argument("channel_id", "")
        if(channel_id == ""):
            self.set_status(400)
            self.finish(json.dumps({
                "status": 400,
                "message": "Missing channel_id"
            }))
            return
        push_channel_type = self._config.push_channel_type
        api_key = self._config.api_key
        data = self.get_query_argument("data", "{}")
        if (data == ""):
            self.set_status(400)
            self.finish(json.dumps({
                "status": 400,
                "message": "Missing data"
            }))
            return
        if (push_channel_type == "sora-cloud"):
            await self.push_channel_sora_cloud(api_key, channel_id, data)
            return
        recv_connection_id = self.get_query_argument("recv_connection_id", "")
        if (recv_connection_id == ""):
            self.set_status(400)
            self.finish(json.dumps({
                "status": 400,
                "message": "Missing recv_connection_id"
            }))
            return
        if (push_channel_type != "meeting.dev"):
            self.set_status(500)
            self.finish(json.dumps({
                "status": 500,
                "message": "Invalid push_channel_type"
            }))
            return
        await self.push_channel_meeting_dev(api_key, channel_id, data, recv_connection_id)

    async def push_channel_sora_cloud(self, api_key, channel_id, data):
        headers = {
            "Authorization": "Bearer " + api_key,
            "x-sora-target": "Sora_20160711.PushChannel",
            "Content-Type": "application/json"
        }
        push_data = {
            "type": "push",
            "content": json.loads(data)
        }
        params = {
            "channel_id": channel_id,
            "data": push_data
        }

        url = "https://api.sora-cloud.shiguredo.app/sora-api"

        status = -1
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=params) as response:
                status = response.status
        self.set_status(status)
        self.finish(json.dumps({
            "status": status
        }))

    async def push_channel_meeting_dev(self, api_key, channel_id, data, recv_connection_id):
        url = self._config.push_channel_url
        if (url == ""):
            self.set_status(500)
            self.finish(json.dumps({
                "status": 500,
                "message": "push_channel_url is not set"
            }))
            return
        url = url.replace('{channelId}', channel_id)
        headers = {
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json"
        }
        params = {
            "data": json.loads(data),
            "recv_connection_id": recv_connection_id,
        }
        status = -1
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=params) as response:
                status = response.status

        self.set_status(status)
        self.finish(json.dumps({
            "status": status
        }))

class ChangeSpotlightRidHandler(APIHandler):
    def initialize(self, config):
        self._config = config

    @tornado.web.authenticated
    async def post(self):
        channel_id = self.get_query_argument("channel_id", "")
        if(channel_id == ""):
            self.set_status(400)
            self.finish(json.dumps({
                "status": 400,
                "message": "Missing channel_id"
            }))
            return
        body_obj = self.get_json_body()
        item_list = body_obj.get("item_list")
        recv_connection_id = body_obj.get("recv_connection_id")
        if(item_list == None or recv_connection_id == None):
            self.set_status(400)
            self.finish(json.dumps({
                "status": 400,
                "message": "Missing item_list or recv_connection_id"
            }))
            return
        changeSpotlightRidUrl = self._config.change_spotlight_rid_url
        if (changeSpotlightRidUrl == ""):
            self.set_status(200)
            self.finish(json.dumps({
                "status": 200,
                "changed": "none"
            }))
            return
        api_key = self._config.api_key
        url = changeSpotlightRidUrl.replace('{channelId}', channel_id)
        headers = {
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json"
        }
        params = {
            "item_list": item_list,
            "recv_connection_id": recv_connection_id
        }
        status = -1
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=params) as response:
                status = response.status
        self.set_status(status)
        self.finish(json.dumps({
            "status": status
        }))