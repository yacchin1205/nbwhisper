import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './handler';
import { WaitingUserListWidget } from './waitingUserListWidget';
import { Widget } from '@lumino/widgets';
import { Client, User } from './user';
import { UserState } from './userState';
import { TalkingViewWidget } from './talkingViewWidget';
import { DialogWidget } from './dialogWidget';
import Enumerable from 'linq';
import { MiniTalkingViewWidget } from './miniTalkingViewWidget';
import { SfuClientManager, SfuClientEvent } from './sfuClientManager';
import { generateUuid } from './uuid';
import { DummyCanvasWidget } from './dummyCanvasWidget';

let Sora : any;
// 本来は
// yarn add sora-js-sdk@2022.1.0
// で入れるべきだが、ビルド時以下のエラーになるのでCDNから使用する。
// Cannot find module '@sora/e2ee' or its corresponding type declarations.
//
// 2 import SoraE2EE from "@sora/e2ee";
//                        ~~~~~~~~~~~~
//
//
// Found 1 error in node_modules/sora-js-sdk/dist/base.d.ts:2
function loadScript(src: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
async function initializeSoraSDK(): Promise<boolean> {
    try {
        await loadScript('https://cdn.jsdelivr.net/npm/sora-js-sdk@2022.1.0/dist/sora.min.js');
        Sora = (window as any).Sora;
        console.log('Sora JavaScript SDKが正常にロードされました');
        console.log(Sora);
        return true;
    } catch (error) {
        console.error('Sora JavaScript SDKのロード中にエラーが発生しました', error);
        return false;
    }
}

async function getAudioStream(dummyCanvasWidget : DummyCanvasWidget) {
    const constraints = {
        "audio" : true
    };
    try {
        // オーディオ
        const audioStream = await navigator.mediaDevices.getUserMedia(constraints);
        const audioTrack = audioStream.getAudioTracks()[0];
        if(!audioTrack) return null;
        // ビデオ
        const videoStream = dummyCanvasWidget.captureStream();
        const videoTrack = videoStream?.getVideoTracks()[0];
        if(!videoTrack) return null;
        // 合成して返す
        return new MediaStream([videoTrack, audioTrack]);
    }
    catch(e) {
        console.error("getAudioStream error:");
        console.error(e);
        return null;
    }
}

async function getDisplayTrack() {
    let option = {
        video : true,
        selfBrowserSurface: 'include',
        // preferCurrentTab: true   // trueにすると、Chromeでこのタブ「しか」選べなくなるのでコメントアウト
    };
    try {
        // ディスプレイ
        const displayStream = await navigator.mediaDevices.getDisplayMedia(option);
        if(!displayStream) return null;
        return displayStream.getVideoTracks()[0];
    }
    catch(e) {
        console.error("getDisplayTrack error:")
        console.error(e);
        return null;
    }
}

function getDummyCanvasTrack(dummyCanvasWidget : DummyCanvasWidget) {
    try {
        // ビデオ
        const videoStream = dummyCanvasWidget.captureStream();
        if(!videoStream) return null;
        // 合成して返す
        return videoStream.getVideoTracks()[0];
    }
    catch(e) {
        console.error("getDummyCanvasTrack error:");
        console.error(e);
        return null;
    }
}

function stopMediaStream(stream : MediaStream) {
    stream.getVideoTracks().forEach(t => t.stop());
    stream.getAudioTracks().forEach(t => t.stop());
}

// プッシュの種別
export class PushKind {
    // クライアント情報
    static readonly Client = "Client";
    // 招待
    static readonly Invite = "Invite"
}

// プッシュのパラメータ
interface PushData {
    kind : string;
}
interface ClientPushData extends PushData {
    client : Client;
    needs_response : boolean
}
interface InvitePushData extends PushData {
    target : string[];
    user_name : string;
    room_name : string;
    talking_client_id : string;
}

async function activate(app : JupyterFrontEnd) {
    console.log('JupyterLab extension nbwhisper is activated!');

    // jupyter_notebook_config.pyから設定の読み込み
    let data = await requestAPI<any>('config');
    let username = data.username ?? "";
    let apiKey = data.api_key ?? "";
    let signalingUrls = data.signaling_url ?? "";
    let channelIdPrefix = data.channel_id_prefix ?? "";
    let channelIdSuffix = data.channel_id_suffix ?? ""; // Sora cloudでは "@プロジェクト名"

    if(!await initializeSoraSDK()) {
        alert("SDKが初期化できませんでした")
        return;
    }

    // 自身のクライアント情報
    let ownClient : Client = new Client();
    ownClient.user_name = username;
    //TEST 別ユーザー扱いにする
    ownClient.user_name += generateUuid().substring(0, 8);

    // ローカルストリーム
    let localStream : MediaStream | null = null;

    // リモートストリーム
    let remoteStreams : MediaStream[] = [];

    // 自身のユーザー情報
    let ownUser : User = new User();
    ownUser.name = ownClient.user_name;
    // ユーザーリスト
    let allUsers : User[] = [];

    // 待機ユーザーリストウィジェット
    const waitingUserListWidget = new WaitingUserListWidget(allUsers);
    Widget.attach(waitingUserListWidget, document.body);

    // ミニ通話画面ウィジェット
    const miniTalkingViewWidget = new MiniTalkingViewWidget(allUsers, ownUser);
    Widget.attach(miniTalkingViewWidget, document.body);
    miniTalkingViewWidget.hide();

    // 通話画面ウィジェット
    const talkingViewWidget = new TalkingViewWidget(allUsers, ownUser, remoteStreams);
    Widget.attach(talkingViewWidget, document.body);

    // ダイアログウィジェット
    const dialogWidget = new DialogWidget();
    Widget.attach(dialogWidget, document.body);

    // ダミーキャンバスウィジェット
    const dummyCanvasWidget = new DummyCanvasWidget();
    Widget.attach(dummyCanvasWidget, document.body);

    // ウィジェットの更新
    const updateWidgets = () => {
        waitingUserListWidget.update();
        miniTalkingViewWidget.update();
        talkingViewWidget.update();
    };

    // リモートストリーム追加
    const addRemoteStream = (stream : MediaStream) => {
        if(!Enumerable.from(remoteStreams).where(x => x.id == stream.id).any()) {
            // Idが存在していない場合は追加
            remoteStreams.push(stream);
            return true;
        }
        return false;
    }

    // リモートストリームの存在確認
    const hasRemoteStream = (id : string) => {
        return Enumerable.from(remoteStreams).where(x => x.id == id).any();
    }

    // リモートストリームの削除
    const removeRemoteStream = (id : string) => {
        let removeIndexes : number[] = [];
        for(let i = remoteStreams.length - 1; i >= 0; --i) {
            if(remoteStreams[i].id == id) removeIndexes.push(i);
        }
        removeIndexes.forEach(i => remoteStreams.splice(i, 1));
        return removeIndexes.length > 0;
    }

    // リモートストリームの全削除
    const clearRemoteStreams = () => {
        let length = remoteStreams.length;
        for(let i = length - 1; i >= 0; --i) {
            remoteStreams.splice(i, 1);
        }
    }

    const showRequestTalkingDialog = async (users : User[]) => {
        let subBody = `${users.length}名に送信します :\n`;
        subBody += Enumerable.from(users).select(u => u.name).toArray().join(", ");
    
        return await dialogWidget.showAskDialog({
            body: "通話リクエストを送信しますか？",
            subBody: subBody,
            ok: "送信",
            cancel: "キャンセル",
        });
    };

    const showAcceptRequestDialog = async (userName : string, targetUserNames : string[]) => {
        let body = `${userName}から通話への参加リクエストが届きました。参加しますか？`;
        let subBody = `${targetUserNames.length}名にリクエスト中 :\n`;
        subBody += targetUserNames.join(", ");

        return await dialogWidget.showAskDialog({
            body: body,
            subBody: subBody,
            ok: "参加",
            cancel: "参加しない",
        });
    };

    // クライアントマネージャー
    const sfuClientManager = new SfuClientManager(
        signalingUrls,
        channelIdPrefix,
        channelIdSuffix,
        apiKey,
        Sora
    );

    // 自身のユーザー状態を更新する
    const changeUserState = (newState : UserState) => {
        ownClient.state = newState;
        let pushData : ClientPushData = {
            kind : PushKind.Client,
            client : ownClient,
            needs_response : false
        }
        sfuClientManager.sendPushToWaitingChannel(pushData);
    };

    // 待機チャンネルに接続
    let waitingClientId = await sfuClientManager.connectToWaitingChannel();
    if(waitingClientId == "") {
        alert("通信に失敗しました");
        return;
    }
    console.log("connected to waiting channel, client id = " + waitingClientId);
    ownClient.waiting_client_id = waitingClientId;
    
    // 待機チャンネルにPushが送られた場合
    sfuClientManager.on(SfuClientEvent.PushFromWaiting, async (data : object) => {
        let pushData = data as PushData;
        if(pushData.kind == PushKind.Client) {
            // クライアント情報
            let clientPushData = data as ClientPushData;
            let needsResponse = clientPushData.needs_response
            let clientData = Object.assign(new Client(), clientPushData.client);
            
            if(clientData.waiting_client_id == ownClient.waiting_client_id) {
                // 同一クライアントの場合はスルー
                console.log("waiting client id: " + clientData.waiting_client_id + " is the same client.");
                return;
            } else if(clientData.user_name == ownUser.name) {
                // 自分の情報の更新
                console.log("waiting client id: " + clientData.waiting_client_id + " is mine. update own user.");
                let existedClient = Enumerable.from(ownUser.clients).where(c => c.waiting_client_id == clientData.waiting_client_id).firstOrDefault();
                if(existedClient) {
                    // 既存のクライアントの場合データ更新
                    existedClient.update(clientData);
                } else {
                    // 新規クライアントの場合追加
                    ownUser.clients.push(clientData);
                }
            } else {
                // 他ユーザーの情報更新
                console.log("waiting client id: " + clientData.waiting_client_id + " is other's. update all users.");
                let targetUser = Enumerable.from(allUsers).where(u => u.name == clientData.user_name).firstOrDefault();
                if(targetUser) {
                    let existedClient = Enumerable.from(targetUser.clients).where(c => c.waiting_client_id == clientData.waiting_client_id).firstOrDefault();
                    if(existedClient) {
                        // 既存のクライアントの場合データ更新
                        existedClient.update(clientData);
                    } else {
                        // 新規クライアントの場合追加
                        ownUser.clients.push(clientData);
                    }
                    // このユーザーの通話チャンネルクライアントIdに該当するストリームが存在している場合、
                    // ユーザーを通話参加中にする
                    if(Enumerable.from(targetUser.clients).where(c => hasRemoteStream(c.talking_client_id)).any()) {
                        console.log(`[push] client id is joined.`);
                        targetUser.is_joined = true;
                        targetUser.is_invited = false;
                    }
                } else {
                    // 新ユーザーの追加
                    let newUser = new User();
                    newUser.name = clientData.user_name;
                    newUser.clients.push(clientData);
                    allUsers.push(newUser);
                }
            }
            // ウィジェット更新
            updateWidgets();

            if(needsResponse) {
                // 自身の情報を送り返す
                console.log("response my user info.")
                let pushData : ClientPushData = {
                    kind : PushKind.Client,
                    client : ownClient,
                    needs_response : false
                };
                sfuClientManager.sendPushToWaitingChannel(pushData);
            }
        } else if(pushData.kind == PushKind.Invite) {
            // 招待
            let invitePushData = data as InvitePushData;
            let targetUserNames = invitePushData.target;
            if(targetUserNames.includes(ownUser.name)) {
                // 自身が招待を受けた
                // -> 着信中
                changeUserState(UserState.Invited);
                // ダイアログ表示
                if(await showAcceptRequestDialog(invitePushData.user_name, targetUserNames)) {
                    // 通話が生きているか確認する
                    let isAliveTalking = false;
                    let sentUser = Enumerable.from(allUsers).where(u => u.name == invitePushData.user_name).firstOrDefault();
                    if(sentUser) {
                        // ユーザーが(待機チャンネルに)存在する
                        if(Enumerable.from(sentUser.clients).where(c => c.talking_client_id == invitePushData.talking_client_id).any()) {
                            // ユーザーが通話クライアントIdを保持している
                            isAliveTalking = true;
                        }
                    }
                    if(!isAliveTalking) {
                        alert("通話が終了したため、この招待は無効になりました");
                        // -> 待機中
                        changeUserState(UserState.Standby);
                        return;
                    }
                    // オーディオストリーム取得
                    localStream = await getAudioStream(dummyCanvasWidget);
                    if(!localStream) {
                        alert("マイクを使用することができないため、通話を開始することができませんでした");
                        // -> 待機中
                        changeUserState(UserState.Standby);
                        return;
                    }
                    console.log("local stream id = " + localStream.id);
                    // 通話ビュー表示
                    talkingViewWidget.showWidget();
                    // ルームに入る
                    let talkingClientId = await sfuClientManager.connectToTalkingChannel(invitePushData.room_name, localStream);
                    if(talkingClientId == "") {
                        alert("通話の開始に失敗しました");
                        // -> 待機中
                        changeUserState(UserState.Standby);
                        return;
                    }
                    console.log("connected to talking channel, client id = " + talkingClientId);
                    ownClient.talking_client_id = talkingClientId;
                    // -> 通話中
                    changeUserState(UserState.Talking);
                } else {
                    // -> 待機中
                    changeUserState(UserState.Standby);
                }
            }
        }
    });

    // 待機チャンネルからクライアントが離脱した場合
    sfuClientManager.on(SfuClientEvent.ClientLeaveFromWaiting, (clientId : string) => {
        console.log("remove user clientId: " + clientId);
        // 抜けたClientを削除していく
        // 自身
        let removeIndexes : number[] = [];
        for(let i = ownUser.clients.length - 1; i >= 0; --i) {
            if(ownUser.clients[i].waiting_client_id == clientId) removeIndexes.push(i);
        }
        removeIndexes.forEach(i => ownUser.clients.splice(i, 1));
        // 他ユーザー
        let removeUserIndexes : number[] = [];
        for(let j = allUsers.length - 1; j >= 0; --j) {
            let user = allUsers[j];
            removeIndexes = [];
            for(let i = user.clients.length - 1; i >= 0; --i) {
                if(user.clients[i].waiting_client_id == clientId) removeIndexes.push(i);
            }
            removeIndexes.forEach(i => user.clients.splice(i, 1));
            if(user.clients.length <= 0) {
                // Clientがなくなったユーザーを削除対象にする
                removeUserIndexes.push(j);
            }
        }
        // Clientを持たなくなったユーザーを削除する
        removeUserIndexes.forEach(j => allUsers.splice(j, 1));
        // ウィジェット更新
        updateWidgets();
    });

    // 通話チャンネルにストリームが届いた場合
    sfuClientManager.on(SfuClientEvent.TrackStreamOnTalking, (stream : MediaStream) => {
        // ストリームidはクライアントIdと一致することを利用して、各ユーザーの参加状態を更新する
        // 各ユーザーのクライアントIdはPushで通知されるため、この段階ではまだ不明な場合もあるので
        // Push処理のほうでも参加状態更新を行う
        for(let user of allUsers) {
            if(Enumerable.from(user.clients).where(c => c.talking_client_id == stream.id).any()) {
                // このユーザーがストリームの発信元なので、参加者フラグを立て、招待中フラグを落とす
                console.log(`[track] client id = ${stream.id} is joined.`);
                user.is_joined = true;
                user.is_invited = false;
                break;
            }
        }
        addRemoteStream(stream);
        // ウィジェット更新
        updateWidgets();
    });

    // 通話チャンネルからストリームが削除された場合
    sfuClientManager.on(SfuClientEvent.RemoveStreamOnTalking, (stream : MediaStream) => {
        if(removeRemoteStream(stream.id)) {
            updateWidgets();
        }
    });

    // 通話チャンネルからクライアントが離脱した場合
    sfuClientManager.on(SfuClientEvent.ClientLeaveFromTalking, (clientId) => {
        // 該当のクライアント情報から通話チャンネルIdを削除
        allUsers.forEach(user => {
            let targetClients = Enumerable.from(user.clients).where(c => c.talking_client_id == clientId).toArray();
            targetClients.forEach(client => client.talking_client_id = "");
            // 通話クライアントIdを持たなくなったユーザーについて、参加中フラグを落とす
            if(!Enumerable.from(user.clients).where(c => c.talking_client_id != "").any()) {
                user.is_joined = false;
            }
        });
        // ウィジェット更新
        updateWidgets();
    });

    // 待機ユーザーリストで「通話をリクエスト」ボタンをクリックした
    waitingUserListWidget.onRequestTalking.connect(async (_, users) => {
        // -> 通話リクエスト確認中
        changeUserState(UserState.Confirming);
        if(await showRequestTalkingDialog(users)) {
            // オーディオストリーム取得
            let stream = await getAudioStream(dummyCanvasWidget);
            if(!stream) {
                alert("マイクを使用することができないため、通話を開始することができませんでした");
                // -> 待機中
                changeUserState(UserState.Standby);
                return;
            }
            localStream = stream;
            console.log("local stream id = " + localStream.id);
            // ターゲット
            let targetUsers = Enumerable.from(allUsers).where(u => u.is_selected).toArray();
            let targetUserNames = Enumerable.from(targetUsers).select(u => u.name).toArray();
            // 通話ルーム名を作成して新規接続
            let roomName = "talking-" + generateUuid();
            let talkingClientId = await sfuClientManager.connectToTalkingChannel(roomName, localStream);
            if(talkingClientId == "") {
                alert("通話の開始に失敗しました");
                stopMediaStream(localStream);
                // -> 待機中
                changeUserState(UserState.Standby);
                return;
            }
            console.log("connected to talking channel, client id = " + talkingClientId);
            ownClient.talking_client_id = talkingClientId;
            // 選択ユーザーに招待中フラグを立て、選択を外す
            targetUsers.forEach(u => { 
                u.is_invited = true;
                u.is_selected = false;
            });
            // ウィジェット更新
            updateWidgets();
            // 通話ビュー表示
            talkingViewWidget.showWidget();
            // 招待を送る
            let pushData : InvitePushData = {
                kind : PushKind.Invite,
                target : targetUserNames,
                user_name : ownUser.name,
                room_name : roomName,
                talking_client_id : talkingClientId
            }
            sfuClientManager.sendPushToWaitingChannel(pushData);
            // -> 呼び出し中
            changeUserState(UserState.Calling);
        } else {
            // -> 待機中
            changeUserState(UserState.Standby);
        }
    });

    // 画面共有を開始する
    const startSharingDisplay = async () => {
        // ディスプレイトラックを取得
        let displayTrack = await getDisplayTrack();
        // 画面共有をブラウザ上でキャンセルした場合もここで返す
        if(!displayTrack) return false;
        // トラックを差し替える
        if(!await sfuClientManager.replaceTalkingChannelVideoTrack(displayTrack)) {
            alert("ディスプレイの共有に失敗しました");
            return false;
        }
        // 通話画面に変更を反映
        ownClient.is_sharing_display = true;
        // ウィジェット更新
        updateWidgets();
        // 自身の情報を送信
        let pushData : ClientPushData = {
            kind : PushKind.Client,
            client : ownClient,
            needs_response : false
        };
        sfuClientManager.sendPushToWaitingChannel(pushData);
        return true;
    };

    // 画面共有をやめる
    const finishSharingDisplay = async () => {
        // ダミーキャンバストラックを取得
        let dummyCanvasTrack = getDummyCanvasTrack(dummyCanvasWidget);
        if(!dummyCanvasTrack) return;
        // トラックを差し替える
        if(!await sfuClientManager.replaceTalkingChannelVideoTrack(dummyCanvasTrack)) {
            alert("ディスプレイの共有停止に失敗しました");
            return false;
        }
        // 通話画面に変更を反映
        ownClient.is_sharing_display = false;
        // ウィジェット更新
        updateWidgets();
        // 自身の情報を送信
        let pushData : ClientPushData = {
            kind : PushKind.Client,
            client : ownClient,
            needs_response : false
        };
        sfuClientManager.sendPushToWaitingChannel(pushData);
        return true;
    };

    // 通話画面で画面共有ボタンを押したときの処理
    talkingViewWidget.onSetSharingDisplay.connect(async (_, isOn) => {
        if(isOn) {
            // ミニ通話画面を表示、通話画面を最小化
            miniTalkingViewWidget.show();
            talkingViewWidget.hideWidget();
            if(!await startSharingDisplay()) {
                // 失敗した場合は通話画面を戻す
                talkingViewWidget.showWidget();
                miniTalkingViewWidget.hide();
            }
        } else {
            await finishSharingDisplay();
        }
    });

    // ミニ通話画面で画面共有ボタンを押したときの処理
    miniTalkingViewWidget.onSetSharingDisplay.connect(async (_, isOn) => {
        if(isOn) {
            await startSharingDisplay();
        } else {
            await finishSharingDisplay();
        }
    });

    // 通話を切る処理
    const hungUp = async () => {
        // ローカルストリームを完全に閉じる
        if(localStream) {
            stopMediaStream(localStream);
        }
        // 切断する
        await sfuClientManager.disconnectFromTalkingChannel();
        allUsers.forEach(u => {
            // 招待中、参加中フラグを落とす
            u.is_invited = false;
            u.is_joined = false;
            // 該当するクライアントのチャンネルIdを削除する
            u.clients.forEach(client => client.talking_client_id = "");
        });
        // 自身の通話クライアントIdを削除
        ownClient.talking_client_id = "";
        // 全てのストリームを削除する
        clearRemoteStreams();
        // ウィジェット更新
        updateWidgets();
        // -> 待機中
        changeUserState(UserState.Standby);
    }

    // 通話画面で切断ボタンを押したときの処理
    talkingViewWidget.onHungUp.connect(async () => {
        await hungUp();
        // 通話画面を閉じる
        talkingViewWidget.hideWidget();
    });

    // ミニ通話画面で切断ボタンを押したときの処理
    miniTalkingViewWidget.onHungUp.connect(async () => {
        await hungUp();
        // ミニ通話画面を閉じる
        miniTalkingViewWidget.hide();
    });

    // 通話画面で最小化ボタンを押したときの処理
    talkingViewWidget.onMinimizeTalkingView.connect(() => {
        miniTalkingViewWidget.show();
        talkingViewWidget.hideWidget();
    });

    // ミニ通話画面で最大化ボタンを押したときの処理
    miniTalkingViewWidget.onMaximizeTalkingView.connect(() => {
        talkingViewWidget.showWidget();
        miniTalkingViewWidget.hide();
    });

    // 自身のユーザー情報を初回プッシュ
    let fistPushData : ClientPushData = {
        kind : PushKind.Client,
        client : ownClient,
        needs_response : true
    };
    sfuClientManager.sendPushToWaitingChannel(fistPushData);
}

/**
 * Initialization data for the nbwhisper extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
    id: 'nbwhisper:plugin',
    description: 'A JupyterLab extension.',
    autoStart: true,
    activate: activate
};

export default plugin;
