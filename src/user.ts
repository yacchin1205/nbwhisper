import { UserState } from "./userState";

// ユーザー情報
// 複数タブ、ウィンドウが開いていても共有する
export class User {
    // 名前
    name : string = "";
    // 通話状態
    state : UserState = UserState.Standby;
    // ミュート
    is_mute : boolean = false;
    // 画面共有
    is_sharing_display : boolean = false;
    // 参加中のルーム名
    joining_room_name : string = "";
    // 待機ルームクライアントIdリスト
    // nameでユーザーを区別するため、複数持つ
    waiting_client_ids : string[] = [];
    // 通話チャンネルクライアントId
    talking_client_ids : string[] = [];

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
        return this.state == UserState.Standby;
    }

    // 別のユーザーの情報で更新する
    public updateFromUser(user : User) {
        this.name = user.name;
        this.state = user.state;
        this.is_mute = user.is_mute;
        this.is_sharing_display = user.is_sharing_display;
    }

    // 接続情報を適用する
    public applyConnectionInfo(info : ConnectionInfo) {
        let waiting_client_id = info.waiting_client_id;
        if(waiting_client_id != "" && !this.waiting_client_ids.includes(waiting_client_id))
            this.waiting_client_ids.push(waiting_client_id);
        let talking_client_id = info.talking_client_id;
        if(talking_client_id != "" && !this.talking_client_ids.includes(talking_client_id))
            this.talking_client_ids.push(talking_client_id);
        let remove_talking_client_id = info.remove_talking_client_id;
        if(remove_talking_client_id != "" && this.talking_client_ids.includes(remove_talking_client_id))
            this.talking_client_ids = this.talking_client_ids.filter(x => x != remove_talking_client_id);
    }
}

// 通信情報
// 複数タブ、ウィンドウごと(通信ごと)別に管理する
export class ConnectionInfo {
    // 待機チャンネルクライアントId
    waiting_client_id : string = "";
    // 通話チャンネルクライアントId
    talking_client_id : string = "";
    // 削除対象とする通話チャンネルクライアントId
    remove_talking_client_id : string = "";
}