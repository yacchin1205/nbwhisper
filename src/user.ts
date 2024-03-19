import Enumerable from "linq";
import { UserState } from "./userState";

// クライアント情報
// 複数タブ、ウィンドウごと(通信ごと)別に管理・公開する
export class Client {
    // 待機チャンネルクライアントId
    waiting_client_id = "";
    // 通話チャンネルクライアントId
    talking_client_id = "";
    // 通話チャンネルルーム名
    talking_room_name = "";
    // ユーザー名
    user_name = "";
    // 通話状態
    state : UserState = UserState.Standby;
    // ミュート
    is_mute : boolean = false;
    // 画面共有
    is_sharing_display : boolean = false;

    public update(client : Client) {
        this.waiting_client_id = client.waiting_client_id;
        this.talking_client_id = client.talking_client_id;
        this.talking_room_name = client.talking_room_name;
        this.user_name = client.user_name;
        this.state = client.state;
        this.is_mute = client.is_mute;
        this.is_sharing_display = client.is_sharing_display;
    }
}

// ユーザー管理情報
export class User {
    // 名前
    name : string = "";
    // 所有クライアント
    clients : Client[] = [];

    /** ローカルでのみ管理する項目 **/
    // 選択中か？
    is_selected : boolean = false;
    // 自身の招待を受けているか？
    is_invited : boolean = false;
    // 自身の通話に入っているか？
    is_joined : boolean = false;

    // 通話の招待可能か？
    public canInvite()
    {
        return this.getState() == UserState.Standby;
    }

    // ミュートか？
    public isMute() {
        // ミュートになっているクライアントが1つ以上あればミュート
        return Enumerable.from(this.clients).where(c => c.is_mute).any();
    }

    // 画面共有中か？
    public isSharingDisplay() {
        // 共有中になっているクライアントが1つ以上あれば共有中
        return Enumerable.from(this.clients).where(c => c.is_sharing_display).any();
    }

    // 指定のストリームIdについて共有中か？
    public isSharingDisplayStream(id : string) {
        return Enumerable.from(this.clients).where(c => c.is_sharing_display && c.talking_client_id == id).any();
    }

    // 通話ルームに参加しているか？
    public isJoiningTalkingRoom(roomName : string) {
        return Enumerable.from(this.clients).where(c => c.talking_room_name == roomName).any();
    }

    // ステータスを取得する
    public getState() {
        let state : UserState = UserState.Standby;
        for(let client of this.clients) {
            if(client.state == UserState.Confirming) {
                if(state == UserState.Standby) {
                    state = UserState.Confirming;
                }
            } else if(client.state == UserState.Invited) {
                if(state == UserState.Standby) {
                    state = UserState.Invited;
                }
            } else if(client.state == UserState.Calling) {
                if(state == UserState.Standby || state == UserState.Confirming) {
                    state = UserState.Calling;
                }
            } else if(client.state == UserState.Talking) {
                if(state == UserState.Standby || state == UserState.Invited || state == UserState.Confirming || state == UserState.Calling) {
                    state = UserState.Talking;
                }
            }
        }
        return state;
    }
}

// 招待情報
export class Invitation {
    // ルーム名
    room_name : string = "";
    // 招待元ユーザー
    from_user_name : string = "";
    // 招待元ユーザークライアントId
    from_talking_client_id : string = "";
} 