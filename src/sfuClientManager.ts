import { requestAPI } from './handler';
import Sora from 'sora-js-sdk';
import { ServerConnection } from '@jupyterlab/services';
import { Notification } from '@jupyterlab/apputils';

// イベントの種類
export class SfuClientEvent {
  // 待機チャンネルにプッシュがあった
  static readonly PushFromWaiting = 'PushFromWaiting';
  // 待機チャンネルに参加があった
  static readonly ClientJoinWaiting = 'ClientJoinWaiting';
  // 待機チャンネルから抜けた
  static readonly ClientLeaveFromWaiting = 'ClientLeaveFromWaiting';
  // 通話チャンネルのストリームが届いた
  static readonly TrackStreamOnTalking = 'TrackStreamOnTalking';
  // 通話チャンネルのストリームがなくなった
  static readonly RemoveStreamOnTalking = 'RemoveStreamOnTalking';
  // 通話チャンネルから抜けた
  static readonly ClientLeaveFromTalking = 'ClientLeaveFromTalking';
}

export class SfuClientManager {
  private debug = false;

  private sora;
  private channelIdPrefix: string;
  private channelIdSuffix: string;
  private userDisplayName: string;

  private waitingChannel: PushChannelClient | null = null;
  private talkingChannel: TalkChannelClient | null = null;

  private events: { [event: string]: (data: any) => void } = {};

  constructor(
    signalingUrl: string,
    channelIdPrefix: string,
    channelIdSuffix: string,
    userDisplayName: string
  ) {
    const signalingUrls = signalingUrl !== null ? signalingUrl.split(',') : [];
    this.sora = Sora.connection(signalingUrls, this.debug);
    this.channelIdPrefix = channelIdPrefix;
    this.channelIdSuffix = channelIdSuffix;
    this.userDisplayName = userDisplayName;
  }

  // イベントの登録
  public on(event: string, callback: (data: any) => void) {
    this.events[event] = callback;
  }

  sendEvent(event: string, data: any) {
    if (event in this.events) {
      this.events[event](data);
    }
  }

  // 待機チャンネルに接続してクライアントIdを返す
  async connectToWaitingChannel() {
    // チャンネル名生成
    const channelId = `${this.channelIdPrefix}waiting${this.channelIdSuffix}`;
    // アクセストークンを得る
    const response = await requestAPI<any>(
      `create-access-token?channel_id=${channelId}&user_display_name=${this.userDisplayName}`
    );
    const responseObj = JSON.parse(response.text);
    const { metadata, signaling_notify_metadata } = responseObj;
    this.waitingChannel = new PushChannelClient(
      this.sora,
      channelId,
      data => this.onPushedWaitingChannel(data),
      clientId => this.onClientJoinWaitingChannel(clientId),
      clientId => this.onClientLeftWaitingChannel(clientId)
    );
    // 接続する
    const clientId = await this.waitingChannel.connect(
      metadata,
      signaling_notify_metadata
    );
    if (clientId === null) {
      throw new Error('Waiting channel client id is null.');
    }
    return clientId;
  }

  // 待機チャンネルにPushを送る
  async sendPushToWaitingChannel(data: object) {
    if (this.waitingChannel === null) {
      throw new Error('waiting channel is null.');
    }
    await this.waitingChannel.sendPush(data);
  }

  onPushedWaitingChannel(data: object) {
    this.sendEvent(SfuClientEvent.PushFromWaiting, data);
  }

  onClientJoinWaitingChannel(cliendId: string) {
    this.sendEvent(SfuClientEvent.ClientJoinWaiting, cliendId);
  }

  onClientLeftWaitingChannel(clientId: string) {
    this.sendEvent(SfuClientEvent.ClientLeaveFromWaiting, clientId);
  }

  async connectToTalkingChannel(roomName: string, localStream: MediaStream) {
    // チャンネル名生成
    const channelId = `${this.channelIdPrefix}${roomName}${this.channelIdSuffix}`;
    // アクセストークンを得る
    const response = await requestAPI<any>(
      `create-access-token?channel_id=${channelId}&user_display_name=${this.userDisplayName}`
    );
    const responseObj = JSON.parse(response.text);
    const { metadata, signaling_notify_metadata } = responseObj;
    this.talkingChannel = new TalkChannelClient(
      this.sora,
      channelId,
      stream => this.onTrackStreamTalkingChannel(stream),
      stream => this.onRemoveStreamTalkingChannel(stream),
      clientId => this.onClientLeftTalkingChannel(clientId)
    );
    // 接続する
    const clientId = await this.talkingChannel.connect(
      localStream,
      metadata,
      signaling_notify_metadata
    );
    if (clientId === null) {
      throw new Error('Talking channel client id is null.');
    }
    return clientId;
  }

  async replaceTalkingChannelVideoTrack(track: MediaStreamTrack) {
    if (this.talkingChannel === null) {
      throw new Error('taking channel is null');
    }
    await this.talkingChannel.replaceVideoTrack(track);
  }

  async disconnectFromTalkingChannel() {
    if (this.talkingChannel === null) {
      return;
    }
    await this.talkingChannel.disconnect();
  }

  // 通話チャンネルを通してクライアントの focus_rid, unfocus_rid を変更する
  async changeTakingChannelSpotlightRids(
    myClientId: string,
    otherClientIds: string[]
  ) {
    return (
      (await this.talkingChannel?.changeSpotlightRids(
        myClientId,
        otherClientIds
      )) ?? false
    );
  }

  onTrackStreamTalkingChannel(stream: MediaStream) {
    this.sendEvent(SfuClientEvent.TrackStreamOnTalking, stream);
  }

  onRemoveStreamTalkingChannel(stream: MediaStream) {
    this.sendEvent(SfuClientEvent.RemoveStreamOnTalking, stream);
  }

  onClientLeftTalkingChannel(clientId: string) {
    this.sendEvent(SfuClientEvent.ClientLeaveFromTalking, clientId);
  }
}

// Push用チャンネルクライアント
class PushChannelClient {
  private sora;
  private connection!: any;
  private channelId: string;
  private onPushed!: (data: object) => void;
  private onClientJoined: (clientId: string) => void;
  private onClientLeft!: (cliendId: string) => void;

  constructor(
    sora: any,
    channelId: string,
    onPushed: (data: object) => void,
    onClientJoined: (clientId: string) => void,
    onClientLeft: (cliendId: string) => void
  ) {
    this.sora = sora;
    this.channelId = channelId;
    this.connection = this.sora.recvonly(this.channelId);
    this.onPushed = onPushed;
    this.onClientJoined = onClientJoined;
    this.onClientLeft = onClientLeft;

    this.connection.on('notify', this.onNotify.bind(this));
    this.connection.on('push', this.onPush.bind(this));
  }

  async connect(metadata: any, signalingNotifyMetadata: any) {
    if (metadata) {
      this.connection.metadata = Object.assign({}, metadata);
      if (metadata.channel_id) {
        // Fix channelId for meeting.dev
        this.connection.channelId = metadata.channel_id;
        this.channelId = metadata.channel_id;
      }
    }
    if (signalingNotifyMetadata) {
      this.connection.options = Object.assign(this.connection.options, {
        signalingNotifyMetadata: signalingNotifyMetadata
      });
    }
    await this.connection.connect();
    return this.connection.clientId;
  }

  async disconnect() {
    await this.connection.disconnect();
  }

  async sendPush(data: object) {
    const text = JSON.stringify(data);
    try {
      await requestAPI<any>(
        `push-channel?channel_id=${this.channelId}&data=${text}&recv_connection_id=${this.connection.clientId}`
      );
    } catch (e) {
      let errMsg;
      if (e instanceof ServerConnection.NetworkError) {
        errMsg = `ServerConnection.NetworkError: ${(e as Error).message}`;
      } else if (e instanceof ServerConnection.ResponseError) {
        errMsg = `ServerConnection.ResponseError: ${(e as Error).message}`;
      } else {
        throw e;
      }
      console.error(`${errMsg} occured on sending push data.`, data);
      // show notification
      Notification.error(`push data error. ${errMsg}`, {
        autoClose: false
      });
      return false;
    }
  }

  onNotify(e: any) {
    if (e.event_type === 'connection.created') {
      if (e.client_id === this.connection.clientId) {
        // 自身の接続完了
        console.log('waiting room is connected.');
      } else {
        // 新規メンバーの接続完了
        this.onClientJoined(e.client_id);
      }
    } else if (e.event_type === 'connection.destroyed') {
      // メンバーが抜けた
      this.onClientLeft(e.client_id);
    }
  }

  onPush(e: any) {
    if (e.type === 'push' && e.data.type === 'push') {
      this.onPushed(e.data.content);
    }
  }
}

// 通話用チャンネルクライアント
class TalkChannelClient {
  private sora;
  private connection!: any;
  private channelId: string;
  private onStreamTracked!: (stream: MediaStream) => void;
  private onStreamRemoved!: (stream: MediaStream) => void;
  private onClientLeft!: (cliendId: string) => void;

  constructor(
    sora: any,
    channelId: string,
    onStreamTracked: (stream: MediaStream) => void,
    onStreamRemoved: (stream: MediaStream) => void,
    onClientLeft: (cliendId: string) => void
  ) {
    this.sora = sora;
    this.channelId = channelId;
    this.connection = this.sora.sendrecv(this.channelId);
    this.onStreamTracked = onStreamTracked;
    this.onStreamRemoved = onStreamRemoved;
    this.onClientLeft = onClientLeft;

    this.connection.on('notify', this.onNotify.bind(this));
    this.connection.on('track', this.onTrack.bind(this));
    this.connection.on('removetrack', this.onRemovetrack.bind(this));
  }

  async connect(
    stream: MediaStream,
    metadata: any,
    signalingNotifyMetadata: any
  ) {
    if (metadata) {
      this.connection.metadata = Object.assign({}, metadata);
      if (metadata.channel_id) {
        // Fix channelId for meeting.dev
        this.connection.channelId = metadata.channel_id;
        this.channelId = metadata.channel_id;
      }
    }
    if (signalingNotifyMetadata) {
      this.connection.options = Object.assign(this.connection.options, {
        signalingNotifyMetadata: signalingNotifyMetadata
      });
    }
    await this.connection.connect(stream);
    return this.connection.clientId;
  }

  async disconnect() {
    await this.connection.disconnect();
  }

  async replaceVideoTrack(track: MediaStreamTrack) {
    const stream = this.connection.stream;
    if (stream === null) {
      throw new Error('connection stream is null');
    }
    await this.connection.replaceVideoTrack(stream, track);
  }

  async changeSpotlightRids(myClientId: string, otherClientIds: string[]) {
    const changeSpotlightRidRequest = {
      item_list: otherClientIds.map(clientId => ({
        send_connection_id: clientId,
        spotlight_focus_rid: 'r0',
        spotlight_unfocus_rid: 'r0'
      })),
      recv_connection_id: myClientId
    };
    try {
      const response = await requestAPI<any>(
        `change-spotlight-rid?channel_id=${this.channelId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(changeSpotlightRidRequest)
        }
      );
      console.log(`change spotlight rid result: ${JSON.stringify(response)}`);
      return true;
    } catch (e) {
      let errMsg;
      if (e instanceof ServerConnection.NetworkError) {
        errMsg = `ServerConnection.NetworkError: ${(e as Error).message}`;
      } else if (e instanceof ServerConnection.ResponseError) {
        errMsg = `ServerConnection.ResponseError: ${(e as Error).message}`;
      } else {
        throw e;
      }
      console.error(`${errMsg} occured on changing spotlight rid.`);
      return false;
    }
  }

  onNotify(e: any) {
    if (
      e.event_type === 'connection.created' &&
      e.connection_id === this.connection.connectionId
    ) {
      // 接続完了
      console.log('waiting room is connected.');
    } else if (e.event_type === 'connection.destroyed') {
      // メンバーが抜けた
      console.log('disconnected member = ' + e.client_id);
      this.onClientLeft(e.client_id);
    }
  }

  onTrack(e: any) {
    const stream = e.streams[0];
    this.onStreamTracked(stream);
  }

  onRemovetrack(e: any) {
    const stream = e.target as MediaStream;
    console.log('remove track = ' + stream.id);
    this.onStreamRemoved(stream);
  }
}
