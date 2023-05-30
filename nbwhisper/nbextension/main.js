define([
    'base/js/namespace',
    'jquery',
    'require',
    'base/js/events',
    'base/js/utils',
], function(Jupyter, $, requirejs, events, utils) {
    "use strict";

    const logPrefix = '[nbwhisper]';

    const params = {
        nbwhisper_skyway_api_token: '',
        nbwhisper_room_mode_for_waiting_room: '',
        nbwhisper_room_mode_for_talking_room: ''
    };

    const configure = async function() {
        // Apply server settings
        const server_config = await load_server_config();
        if (!server_config.username) {
            throw new Error('Username not detected');
        }
        own_user_name = own_user.name = server_config.username
        for(const key_ in params) {
            const m = key_.match(/^nbwhisper_(.+)$/);
            const key = m[1];
            const value = server_config[key];
            if (!value) {
                console.log(logPrefix, "param " + key + " is not set on server config");
                continue;
            }
            console.log(logPrefix, "param = " + key + " value = " + value + " on server config");
            params[key_] = value;
        }

        // Apply client settings
        const config = Jupyter.notebook.config;
        for(const key in params) {
            if(config.data.hasOwnProperty(key)) {
                const value = config.data[key];
                if (!value) {
                    console.log(logPrefix, "param " + key + " is not set");
                    continue;
                }
                console.log(logPrefix, "param = " + key + " value = " + value);
                params[key] = value;
            }
        }
    }

    var Peer;

    // 各要素のID
    const ID_PREFIX = "CBEE0ECE-42BD-475D-90F3-A9C2F2EC3191-"; // guidとして事前生成
    const ELEMENT_ID = ID_PREFIX + "realtime-talk";
    const SHOW_USERS_BUTTON_ID = ID_PREFIX + "show-users-button";
    const HIDE_USERS_BUTTON_ID = ID_PREFIX + "hide-users-button";
    const USERS_LIST_DIALOG_ID = ID_PREFIX + "users-list-dialog";
    const REQUEST_TALKING_BUTTON_ID = ID_PREFIX + "request-talking-button";
    const REQUEST_JOINING_BUTTON_ID = ID_PREFIX + "request-joining-button";
    const TALK_SCREEN_ID = ID_PREFIX + "talk-screen";
    const TALKING_PALETTE_ID = ID_PREFIX + "talking-palette";
    const TALK_SCREEN_MUTE_BUTTON_ID = ID_PREFIX + "talk-screen-mute-button";
    const TALK_SCREEN_UNMUTE_BUTTON_ID = ID_PREFIX + "talk-screen-unmute-button";
    const TALK_SCREEN_START_SHARE_DISPLAY_ID = ID_PREFIX + "talk-screen-start-share-display";
    const TALK_SCREEN_STOP_SHARE_DISPLAY_ID = ID_PREFIX + "talk-screen-stop-share-display";
    const TALK_SCREEN_SHOW_MEMBERS_BUTTON_ID = ID_PREFIX + "talk-screen-show-members-button";
    const TALK_SCREEN_HIDE_MEMBERS_BUTTON_ID = ID_PREFIX + "talk-screen-hide-members-button";
    const TALK_SCREEN_MEMBERS_WINDOW_ID = ID_PREFIX + "talk-screen-members-window";
    const TALKING_PALETTE_MUTE_BUTTON_ID = ID_PREFIX + "talking-palette-mute-button";
    const TALKING_PALETTE_UNMUTE_BUTTON_ID = ID_PREFIX + "talking-palette-unmute-button";
    const TALKING_PALETTE_STOP_SHARE_DISPLAY_ID = ID_PREFIX + "talking-palette-stop-share-display";
    const TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_OUTER_ID = ID_PREFIX + "talk-screen-remote-videos-container-outer";
    const TALK_SCREEN_REMOTE_VIDEOS_DESCRIPTION_ID = ID_PREFIX + "talk-screen-remote-videos-description";
    const TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID = ID_PREFIX + "talk-screen-remote-videos-container";
    const TALK_SCREEN_SHARING_USER_NAME_TEXT_ID = ID_PREFIX + "talk-screen-shareing-user-name-text";
    const USERS_TABLE_ID = ID_PREFIX + "users-table";
    const ROOM_MEMBERS_TABLE_ID = ID_PREFIX + "room-members-table";
    const TALK_SCREEN_USERS_TABLE_ID = ID_PREFIX + "talk-screen-users-table";
    const DUMMY_VIDEO_CANVAS_ID = ID_PREFIX + "dummy-video-canvas";
    const MINI_REMOTE_VIDEOS_CONTAINER_ID = ID_PREFIX + "mini-remote-videos-container";
    const STRETCH_MINI_REMOTE_VIDEOS_ID = ID_PREFIX + "stretch-mini-remote-videos";
    const TALK_SCREEN_ADD_MEMBERS_CONTAINER_ID = ID_PREFIX + "talk-screen-add-members-container";
    const TALK_SCREEN_MEMBERS_LIST_ID = ID_PREFIX + "talk_screen-members-list";

    // 各種メッセージ
    // ユーザーデータの更新
    const UPDATE_USER_DATA_MESSAGE = "update_user_data";
    // ユーザーデータ更新に対するレスポンス
    const UPDATE_USER_DATA_RESPONSE_MESSAGE = "update_user_data_response";
    // 通話への招待
    const INVITE_USER_MESSAGE = "invite_user";
    // ミュート
    const MUTE_MESSAGE = "mute";
    const UNMUTE_MESSAGE = "unmute";
    // 画面共有
    const SHARE_START_MESSAGE = "share_start";
    const SHARE_STOP_MESSAGE = "share_stop";

    // 自身のユーザ名
    var own_user_name = "";

    // 自身のユーザー情報及び他のユーザーのリスト
    // 前回との差分を取って変化があった時テーブルを更新したいため、保持しておく
    // name: 名前, is_mute: ミュートか, is_sharing_display: 画面共有中か, peer_id: PeerId, joining_room: 参加中のルーム, invited_rooms: 招待されている部屋
    var own_user = {
        name : "",
        is_mute : false,
        is_sharing_display : false,
        peer_id: null,
        joining_room : "",
        invited_rooms : []
    };
    // 全ユーザー情報
    // peer_id, joining_roomは複数存在する
    // name: 名前, is_mute: ミュートか, is_sharing_display: 画面共有中か, peer_id_to_joining_rooms: peer_idとjoining_roomの連想配列, invited_rooms: 招待されている部屋
    var other_users = [];
    // 自分が他のタブやウィンドウで開いているPeerの情報
    var own_other_peer_id_to_joining_rooms = {}
    
    // 選択ユーザー名
    var selected_user_names = [];
    // ローカルストリーム
    var local_stream = null;
    // ディスプレイストリーム
    var display_stream = null;
    // ピア
    var peer = null;
    // 待機ルーム
    var waiting_room = null;
    // 会話ルーム
    var talking_room = null;
    // ページアンロード処理フラグ
    var is_page_unloading = false;

    /**
     * load css file and append to document
     *
     * @method load_css
     * @param name {String} filenaame of CSS file
     *
     */
    var load_css = function (name) {
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = requirejs.toUrl(name);
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    var load_js_async = function (url) {
        return new Promise(function(resolve) {
            requirejs([url], function(lib) {
                resolve(lib);
            });
        });
    }

    // ルームが存在しているので開始できないアラートを表示
    var show_room_existed_alert = function() {
        alert("他のタブやウィンドウで通話中のため、新たに通話を開始することができませんでした");
    }

    // マイクがキャンセルされた
    var show_mic_cancelled_alert = function() {
        alert("マイクを使用することができないため、通話を開始することができませんでした");
    }

    // 招待は無効(消去された場合。実装してない)
    var show_unavailable_invitation_alert = function() {
        alert("この招待は無効です")
    }

    // 通話が終了したため招待が無効
    var show_unavailable_invitation_with_finished_talk_alert = function() {
        alert("通話が終了したため、この招待は無効になりました")
    }

    // ランダムでuuidを生成する
    const generate_uuid = function() {
        // https://github.com/GoogleChrome/chrome-platform-analytics/blob/master/src/internal/identifier.js
        // const FORMAT: string = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
        let chars = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".split("");
        for (let i = 0, len = chars.length; i < len; i++) {
            switch (chars[i]) {
                case "x":
                    chars[i] = Math.floor(Math.random() * 16).toString(16);
                    break;
                case "y":
                    chars[i] = (Math.floor(Math.random() * 4) + 8).toString(16);
                    break;
            }
        }
        return chars.join("");
    }

    // 非同期メソッドを同期かつ排他で実行する
    var is_busy_in_process = false;
    var invoke_async_process = function(func) {
        if(is_busy_in_process) return;
        console.log(logPrefix, "process start.");
        is_busy_in_process = true;
        func().then(() => {
            is_busy_in_process = false;
            console.log(logPrefix, "process end.");
        });
    }

    const load_server_config = function() {
        return new Promise(function(resolve, reject) {
            const path = Jupyter.notebook.base_url + "nbwhisper/v1/config";
            $.get(path).done(function(data) {
                console.log(logPrefix, 'config', data);
                resolve(data);
            }).fail(function(xhr, status, error) {
                reject(error);
            });
        });
    }

    // ダミーの映像ストリーム用キャンバスの作成
    var create_dummy_video_canvas = function(width = 640, height = 640) {
        let canvas = $("<canvas>").css("position", "fixed").css("top", "100vh");
        let el = canvas.get(0);
        el.width = width;
        el.height = height;
        let draw_loop = function () {
            el.getContext('2d').fillRect(0, 0, width, height);
            requestAnimationFrame(draw_loop);
        }
        draw_loop();
        return canvas;
    }

    var get_offset_right = function(jqObject) {
        return $(window).width() - (jqObject.offset().left + jqObject.outerWidth());
    }

    var get_offset_bottom = function(jqObject) {
        return $(window).height() - (jqObject.offset().top + jqObject.outerHeight());
    }

    var setup_move_and_resize_dialog = function(dialog) {
        // ウィンドウ移動
        dialog.mousedown(function(e) {
            dialog.data("clickPageX", e.pageX);
            dialog.data("clickPageY", e.pageY);
            dialog.data("offsetRight", get_offset_right(dialog));
            dialog.data("offsetBottom", get_offset_bottom(dialog));
            $(document).mousemove(function(e) {
                dialog.css({
                    right: dialog.data("offsetRight") - (e.pageX - dialog.data("clickPageX")) + "px",
                    bottom: dialog.data("offsetBottom") - (e.pageY - dialog.data("clickPageY")) + "px",
                });
                return false;
            });
            $(document).mouseup(function(e) {
                $(document).unbind("mousemove");
                $(document).unbind("mouseup");
                return false;
            });
            return false;
        });
        // ウィンドウリサイズ
        let resize_bar_left = $("<div>").addClass("resize-dialog-bar-left").appendTo(dialog);
        let resize_bar_top = $("<div>").addClass("resize-dialog-bar-top").appendTo(dialog);
        let resize_bar_right = $("<div>").addClass("resize-dialog-bar-right").appendTo(dialog);
        let resize_bar_bottom = $("<div>").addClass("resize-dialog-bar-bottom").appendTo(dialog);
        let resize_bar_topleft = $("<div>").addClass("resize-dialog-bar-topleft").appendTo(dialog);
        let resize_bar_topright = $("<div>").addClass("resize-dialog-bar-topright").appendTo(dialog);
        let resize_bar_bottomright = $("<div>").addClass("resize-dialog-bar-bottomright").appendTo(dialog);
        let resize_bar_bottomleft = $("<div>").addClass("resize-dialog-bar-bottomleft").appendTo(dialog);
        for (let bar of [resize_bar_left, resize_bar_top, resize_bar_right, resize_bar_bottom, 
            resize_bar_topleft, resize_bar_topright, resize_bar_bottomright, resize_bar_bottomleft]) {
            $(bar).mousedown(function(e) {
                dialog.data("clickPageX", e.pageX);
                dialog.data("clickPageY", e.pageY);
                dialog.data("offsetRight", get_offset_right(dialog));
                dialog.data("offsetBottom", get_offset_bottom(dialog));
                dialog.data("clientWidth", dialog.outerWidth());
                dialog.data("clientHeight", dialog.outerHeight());
                $(document).mousemove(function(e) {
                    let deltaX = e.pageX - dialog.data("clickPageX");
                    let deltaY = e.pageY - dialog.data("clickPageY");
                    const DIALOG_SIZE_MIN = 120;
                    if(bar == resize_bar_right || bar == resize_bar_topright || bar == resize_bar_bottomright) {
                        // 幅、右を変更
                        let newWidth = dialog.data("clientWidth") + deltaX;
                        if(newWidth >= DIALOG_SIZE_MIN) {
                            $(dialog).css({
                                right: dialog.data("offsetRight") - deltaX + "px",
                                width: newWidth + "px"
                            });
                        }
                    }
                    if(bar == resize_bar_left || bar == resize_bar_topleft || bar == resize_bar_bottomleft) {
                        // 幅を逆方向に変更
                        let newWidth = dialog.data("clientWidth") - deltaX;
                        if(newWidth >= DIALOG_SIZE_MIN) {
                            $(dialog).css({
                                width: newWidth + "px"
                            });
                        }
                    }
                    if(bar == resize_bar_bottom || bar == resize_bar_bottomright || bar == resize_bar_bottomleft) {
                        // 高さ、下を変更
                        let newHeight = dialog.data("clientHeight") + deltaY;
                        if(newHeight >= DIALOG_SIZE_MIN) {
                            $(dialog).css({
                                bottom: dialog.data("offsetBottom") - deltaY + "px",
                                height: newHeight + "px"
                            });
                        }
                    }
                    if(bar == resize_bar_top || bar == resize_bar_topleft || bar == resize_bar_topright) {
                        // 高さを逆方向に変更
                        let newHeight = dialog.data("clientHeight") - deltaY;
                        if(newHeight >= DIALOG_SIZE_MIN) {
                            $(dialog).css({
                                height: newHeight + "px"
                            });
                        }
                    }
                    return false;
                })
                $(document).mouseup(function(e) {
                    $(document).unbind("mousemove");
                    $(document).unbind("mouseup");
                    return false;
                });
                return false;
            });
        }
    }

    // ユーザーリスト表示
    var show_user_list = function() {
        $("#"+SHOW_USERS_BUTTON_ID).hide();
        $("#"+HIDE_USERS_BUTTON_ID).show();
        $("#"+USERS_LIST_DIALOG_ID).fadeIn("fast");
    }

    // ユーザーリスト隠す
    var hide_user_list = function() {
        $("#"+SHOW_USERS_BUTTON_ID).show();
        $("#"+HIDE_USERS_BUTTON_ID).hide();
        $("#"+USERS_LIST_DIALOG_ID).fadeOut("fast");
    }

    // マイクをミュートにする
    var set_mute = async function(mute) {
        // ボタン変更
        update_mic_button(mute);
        // メッセージ送信
        own_user.is_mute = mute;
        send_message_to_talking_room(mute ? MUTE_MESSAGE : UNMUTE_MESSAGE);
        // ストリーム変更
        set_stream_mute(mute);
        // テーブル更新
        update_tables();
    }

    var update_mic_button = function(mute) {
        if(mute) {
            $("#"+TALK_SCREEN_MUTE_BUTTON_ID).hide();
            $("#"+TALK_SCREEN_UNMUTE_BUTTON_ID).show();
            $("#"+TALKING_PALETTE_MUTE_BUTTON_ID).hide();
            $("#"+TALKING_PALETTE_UNMUTE_BUTTON_ID).show();
        } else {
            $("#"+TALK_SCREEN_MUTE_BUTTON_ID).show();
            $("#"+TALK_SCREEN_UNMUTE_BUTTON_ID).hide();
            $("#"+TALKING_PALETTE_MUTE_BUTTON_ID).show();
            $("#"+TALKING_PALETTE_UNMUTE_BUTTON_ID).hide();
        }
    }

    var set_stream_mute = function(mute) {
        if(local_stream != null) {
            let track = local_stream.getAudioTracks()[0] 
            if(track != null) {
                console.log(logPrefix, "local_stream 音声のミュート状態変更 -> " + mute);
                track.enabled = !mute;
            }
        }
        if(display_stream != null) {
            let track = display_stream.getAudioTracks()[0] 
            if(track != null) {
                console.log(logPrefix, "display_stream 音声のミュート状態変更 -> " + mute);
                track.enabled = !mute;
            }
        }
    }

    // 画面の共有をオンにする
    var set_share_display_on_async = async function() {
        // ONにする前にいったんこのビューを最小化する
        await hide_view_to_bottom_right_async($("#"+TALK_SCREEN_ID));
        // ミニ動画共有コンテナセットアップ
        setup_mini_remote_videos();
        // 共有開始処理
        let new_stream = await start_share_display_async();
        if(new_stream != null) {
            // ボタン更新
            update_share_display_button(true);
            // 共有開始メッセージをルームに送る
            send_message_to_talking_room(SHARE_START_MESSAGE);
            // ストリームを保持する
            display_stream = new_stream;
            // テーブル更新
            own_user.is_sharing_display = true;
            update_tables();
            update_remote_videos();
        } else {
            // ビューを元に戻す
            show_view_from_bottom_right($("#"+TALK_SCREEN_ID));
            dispose_mini_remote_videos();
        }
    }

    // 画面の共有をオフにする
    var set_share_display_off = function() {
        // ボタン更新
        update_share_display_button(false);
        // 共有停止メッセージをルームに送る
        send_message_to_talking_room(SHARE_STOP_MESSAGE);
        // 共有停止処理
        stop_share_display();
        // テーブル更新
        own_user.is_sharing_display = false;
        update_tables();
        // 画面更新
        update_remote_videos();
    }

    var update_share_display_button = function(share_display) {
        if(share_display) {
            $("#"+TALKING_PALETTE_STOP_SHARE_DISPLAY_ID).show();
            $("#"+TALK_SCREEN_START_SHARE_DISPLAY_ID).hide();
            $("#"+TALK_SCREEN_STOP_SHARE_DISPLAY_ID).show();
            $("#"+TALKING_PALETTE_ID).css("width", "200px");
        } else {
            $("#"+TALKING_PALETTE_STOP_SHARE_DISPLAY_ID).hide();
            $("#"+TALK_SCREEN_START_SHARE_DISPLAY_ID).show();
            $("#"+TALK_SCREEN_STOP_SHARE_DISPLAY_ID).hide();
            $("#"+TALKING_PALETTE_ID).css("width", "");
        }
    }

    // 画面共有を開始する
    // return: 生成した画面共有ストリーム
    var start_share_display_async = async function() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                selfBrowserSurface: 'include',
                preferCurrentTab: true
            });
            if(stream == null) return null;
            // ストリームの映像を差し替える
            let audio_track = local_stream.getAudioTracks()[0];
            let video_track = stream.getVideoTracks()[0];
            // 映像ストリーム生成
            let new_stream = new MediaStream([video_track, audio_track]);
            // 差し替える
            talking_room.replaceStream(new_stream);
            // 古いローカルストリームを閉じる
            if(local_stream != null) {
                local_stream.getVideoTracks().forEach(t => t.stop());
                local_stream = null;
            }

            // 自身のストリームを表示するビデオタグを探す
            let my_video = null;
            for(let v of $("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID).children()) {
                if($(v).hasClass("remote-video-shown")) {
                    // 表示中のビデオがあったら非表示にしておく
                    $(v).removeClass("remote-video-shown").addClass("remote-video-hidden");
                }
                if($(v).data("peerId") == own_user.peer_id) {
                    my_video = $(v);
                }
            }
            if(my_video == null) {
                // ない場合は追加する
                my_video = $("<video>")
                    .attr("playsinline", "")
                    .addClass("remote-video-hidden")
                    .data("peerId", own_user.peer_id)
                    .appendTo($("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID));
            }
            let el = my_video.get(0);
            el.srcObject = stream;
            await el.play().catch(console.error);
            return new_stream;
        }
        catch(err) {
            console.error(logPrefix, "start_share_display_async error:");
            console.error(logPrefix, err);
            return null;
        }
    }

    var stop_share_display = function() {
        if(display_stream == null) return;
        // ローカルストリーム生成
        let audio_track = display_stream.getAudioTracks()[0];
        let video_stream = $("#"+DUMMY_VIDEO_CANVAS_ID).get(0).captureStream(1);
        let video_track = video_stream.getVideoTracks()[0];
        local_stream = new MediaStream([video_track, audio_track]);
        // 差し替える
        talking_room.replaceStream(local_stream);
        // 古い映像ストリームを閉じる
        if(display_stream != null) {
            display_stream.getVideoTracks().forEach(t => t.stop());
            display_stream = null;
        }
    }

    // 通話開始のアラートを表示する
    var ask_start_talking_async = function(target_users) {
        return new Promise(function(resolve) {
            let bg = $("<div>").addClass("alert-bg-mask").appendTo($("#"+ELEMENT_ID));
            let surface = $("<div>").addClass("ask-start-talking-alert-surface").appendTo(bg);
            $("<div>").addClass("ask-start-talking-alert-text").text("通話リクエストを送信しますか？").appendTo(surface);
            let cancel_button = $("<div>").addClass("ask-start-talking-alert-cancel-button").appendTo(surface);
            $("<div>").addClass("button-text-dark-gray").text("キャンセル").appendTo(cancel_button);
            let ok_button = $("<div>").addClass("ask-start-talking-alert-ok-button").appendTo(surface);
            $("<div>").addClass("button-text-white").text("送信").appendTo(ok_button);

            if(target_users.length > 1) {
                // 複数人に送信する場合
                surface.css("height", "258px");
                let target_user_names = target_users.join(", ");
                let text_div = $("<div>")
                    .addClass("ask-alert-optional-text-div")
                    .appendTo(surface);
                $("<p>")
                    .text(target_users.length + "名に送信します :")
                    .appendTo(text_div);
                $("<p>")
                    .text(target_user_names)
                    .addClass("ask-alert-optional-text")
                    .appendTo(text_div);
            }

            ok_button.click(function(e) {
                bg.remove();
                resolve(true);
            });
            cancel_button.click(function(e) {
                bg.remove();
                resolve(false);
            });
        });
    }

    // 参加リクエスト送信アラートを表示する
    var ask_request_joining_async = function(target_users) {
        return new Promise(function(resolve) {
            let bg = $("<div>").addClass("alert-bg-mask").appendTo($("#"+ELEMENT_ID));
            let surface = $("<div>").addClass("ask-start-talking-alert-surface").appendTo(bg);
            $("<div>").addClass("ask-start-talking-alert-text").text("参加リクエストを送信しますか？").appendTo(surface);
            let cancel_button = $("<div>").addClass("ask-start-talking-alert-cancel-button").appendTo(surface);
            $("<div>").addClass("button-text-dark-gray").text("キャンセル").appendTo(cancel_button);
            let ok_button = $("<div>").addClass("ask-start-talking-alert-ok-button").appendTo(surface);
            $("<div>").addClass("button-text-white").text("送信").appendTo(ok_button);

            if(target_users.length > 1) {
                // 複数人に送信する場合
                surface.css("height", "258px");
                let target_user_names = target_users.join(", ");
                let text_div = $("<div>")
                    .addClass("ask-alert-optional-text-div")
                    .appendTo(surface);
                $("<p>")
                    .text(target_users.length + "名に送信します :")
                    .appendTo(text_div);
                $("<p>")
                    .text(target_user_names)
                    .addClass("ask-alert-optional-text")
                    .appendTo(text_div);
            }

            ok_button.click(function(e) {
                bg.remove();
                resolve(true);
            });
            cancel_button.click(function(e) {
                bg.remove();
                resolve(false);
            });
        });
    }

    // 通話のリクエストを受けるかアラートを表示する
    var ask_accept_talking = function(owner, room_members) {
        return new Promise(function(resolve) {
            let bg = $("<div>").addClass("alert-bg-mask").appendTo($("#"+ELEMENT_ID));
            let surface = $("<div>").addClass("ask-accept-talking-alert-surface").appendTo(bg);
            $("<div>").addClass("ask-accept-talking-alert-text").text(owner + "から通話への参加リクエストが届きました。参加しますか？").appendTo(surface);
            let cancel_button = $("<div>").addClass("ask-accept-talking-alert-cancel-button").appendTo(surface);
            $("<div>").addClass("icon-button-text").text("参加しない").appendTo(cancel_button);
            let ok_button = $("<div>").addClass("ask-accept-talking-alert-ok-button").appendTo(surface);
            $("<div>").addClass("icon-button-text").text("参加").appendTo(ok_button);

            if(room_members.length > 1) {
                // 複数人がルームにいる場合
                surface.css("height", "258px");
                let room_members_names = room_members.join(", ");
                let text_div = $("<div>")
                    .addClass("ask-alert-optional-text-div")
                    .appendTo(surface);
                $("<p>")
                    .text(room_members.length + "名が参加中です :")
                    .appendTo(text_div);
                $("<p>")
                    .text(room_members_names)
                    .addClass("ask-alert-optional-text")
                    .appendTo(text_div);
            }

            ok_button.click(function(e) {
                bg.remove();
                resolve(true);
            });
            cancel_button.click(function(e) {
                bg.remove();
                resolve(false);
            });
        });
    }

    // 画面を最大化するために共有を停止するかアラートを表示する
    var ask_stop_sharing_for_showing_talk_screen_async = function() {
        return new Promise(function(resolve) {
            let bg = $("<div>").addClass("alert-bg-mask").appendTo($("#"+ELEMENT_ID));
            let surface = $("<div>").addClass("ask-stop-sharing-for-showing-talk-screen-alert-surface").appendTo(bg);
            let text_div = $("<div>").addClass("ask-stop-sharing-for-showing-talk-screen-alert-text").appendTo(surface);
            $("<p>").text("自分の画面共有中は通話画面を開くことができません。").appendTo(text_div);
            $("<p>").text("画面共有を停止しますか？").appendTo(text_div);
            let cancel_button = $("<div>").addClass("ask-stop-sharing-for-showing-talk-screen-alert-cancel-button").appendTo(surface);
            $("<div>").addClass("button-text-white").text("キャンセル").appendTo(cancel_button);
            let ok_button = $("<div>").addClass("ask-stop-sharing-for-showing-talk-screen-alert-ok-button").appendTo(surface);
            $("<div>").addClass("button-text-white").text("停止する").appendTo(ok_button);

            ok_button.click(function(e) {
                bg.remove();
                resolve(true);
            });
            cancel_button.click(function(e) {
                bg.remove();
                resolve(false);
            });
        });
    }

    var show_view_from_bottom_right = function(view) {
        view.show();
        view.animate({
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
            opacity: 1
        }, 400, "swing", function(){
        });
    }

    var hide_view_to_bottom_right = function(view) {
        view.animate({
            left: "100%",
            top: "100%",
            width: "0",
            height: "0",
            opacity: 0
        }, 400, "swing", function(){
            view.hide();
        });
    }

    var hide_view_to_bottom_right_async = function(view) {
        return new Promise(resolve => {
            view.animate({
                left: "100%",
                top: "100%",
                width: "0",
                height: "0",
                opacity: 0
            }, 400, "swing", function(){
                view.hide();
                resolve();
            });
        });
    }

    var setup_mini_remote_videos = function() {
        // ミニ動画共有コンテナの配下に動画を移動
        $("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID).prependTo($("#"+MINI_REMOTE_VIDEOS_CONTAINER_ID));
    }

    var dispose_mini_remote_videos = function() {
        // 共有画面を通話スクリーンのコンテナに移動
        $("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID).appendTo("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_OUTER_ID);
    }

    // オーディオストリームをセットアップする
    // return: オーディオストリーム
    var setup_audio_stream = async function() {
        let constraints = {
            "audio": true
        };
        try {
            let stream = await navigator.mediaDevices.getUserMedia(constraints);
            // オーディオトラック
            let audio_track = stream.getAudioTracks()[0];
            // ビデオトラック
            let video_stream = $("#"+DUMMY_VIDEO_CANVAS_ID).get(0).captureStream(1);
            let video_track = video_stream.getVideoTracks()[0];
            return new MediaStream([video_track, audio_track]);
        }
        catch(err) {
            console.error(logPrefix, "navigator.mediaDevices.getUserMedia error:");
            console.error(logPrefix, err);
            return null;
        }
    }

    // Peerをセットアップする
    const setup_peer = function() {
        return new Promise(function(resolve, reject) {
            peer = null;
            own_user.peer_id = null;
            try {
                let _peer = new Peer({
                    key: params.nbwhisper_skyway_api_token,
                    debug: 3
                });

                _peer.once("open", function(peer_id) {
                    console.log(logPrefix, "peer opened, id = " + peer_id);
                    peer = _peer;
                    own_user.peer_id = _peer.id;
                    resolve(peer);
                });

                _peer.once("error", function(err) {
                    console.error(logPrefix, "peer error.");
                    console.error(logPrefix, err);
                    reject(new Error("NBWhisperに不明なエラーが発生しました。このページを再読み込みしてください。(" + err + ")"));
                });
            }
            catch(e) {
                console.error(logPrefix, e);
                // e = Error: API KEY "..." is invalidの場合はその旨をエラーとして表示する
                if(e.toString().match(/^.*API\sKEY.*is\sinvalid.*$/g)) {
                    reject(new Error("NBWhisperのAPIキーの設定が間違っています。設定を見直してNotebookを開き直してください。(" + e.toString() + ")"));
                } else {
                    // その他のエラー
                    reject(new Error("NBWhisperの初期化に失敗しました。設定またはネットワークを見直してページを開き直してください。(" + e.toString() + ")"));
                }
            }
        });
    }

    // 会話ルームに入る
    var join_talking_room = function(room_name) {
        talking_room = peer.joinRoom(room_name, {
            mode: params.nbwhisper_room_mode_for_talking_room,
            stream: local_stream
        });
        if(talking_room == null) {
            console.log(logPrefix, "cannot create talking room...");
            return;
        }

        talking_room.once("open", function() {
            console.log(logPrefix, "room open")
            // room_openを他のメンバーに通知する
            send_message_to_talking_room(UPDATE_USER_DATA_MESSAGE);
        });

        talking_room.on("peerJoin", function(peer_id) {
            console.log(logPrefix, "peer joined to room: " + peer_id);
        });

        talking_room.on("peerLeave", function(peer_id) {
            console.log(logPrefix, "peer left from room: " + peer_id);
            // ビデオタグを削除
            let video = null;
            for(let v of $("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID).children()) {
                if($(v).data("peerId") == peer_id) {
                    video = v;
                    break;
                }
            }
            if(video != null) {
                video.srcObject.getTracks().forEach(t => t.stop());
                video.srcObject = null;
                $(video).remove();
                console.log(logPrefix, "removed video");
            }
            // ルーム情報削除
            for(let user of other_users) {
                if(peer_id in user.peer_id_to_joining_rooms) {
                    user.peer_id_to_joining_rooms[peer_id] = "";
                }
            }
            update_tables();
        });

        talking_room.on("stream", async function(stream) {
            console.log(logPrefix, "stream received in room: " + stream.peerId);
            // ストリームを再生するvideoを追加する
            let new_video = $("<video>")
                .attr("playsinline", "")
                .addClass("remote-video-hidden")
                .data("peerId", stream.peerId)
                .appendTo($("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID));
            let el = new_video.get(0);
            el.srcObject = stream;
            await el.play().catch(console.error);
        });

        talking_room.on("data", async function(data) {
            if(data == null) return;
            let message_obj = JSON.parse(data.data);
            let peer_id = data.src;
            console.log(logPrefix, "meesage from: " + peer_id);
            console.log(logPrefix, message_obj);

            if(message_obj.message == UPDATE_USER_DATA_MESSAGE || message_obj.message == UPDATE_USER_DATA_RESPONSE_MESSAGE) {
                if(message_obj.message == UPDATE_USER_DATA_MESSAGE) {
                    // レスポンスする: この処理で新規メンバーにも自身のPeerIdが伝わる
                    send_message_to_talking_room(UPDATE_USER_DATA_RESPONSE_MESSAGE);
                }
                // 情報更新
                setTimeout(() => {
                    if(message_obj.user_name == own_user_name) {
                        return;
                    }
                    let existed_index = -1;
                    for(let i = 0; i < other_users.length; ++i) {
                        if(other_users[i].name == message_obj.user_name) {
                            existed_index = i;
                            break;
                        }
                    }
                    if(existed_index >= 0) {
                        // 更新
                        other_users[existed_index].peer_id_to_joining_rooms[peer_id] = own_user.joining_room;
                        other_users[existed_index].is_mute = message_obj.is_mute;
                        other_users[existed_index].is_sharing_display = message_obj.is_sharing_display;
                    } else {
                        // 追加
                        let new_user = {
                            name : message_obj.user_name,
                            is_mute : message_obj.is_mute,
                            is_sharing_display : message_obj.is_sharing_display,
                            peer_id_to_joining_rooms : { peer_id: own_user.joining_room },
                            invited_rooms : []
                        }
                        other_users.push(new_user);
                    }
                    // テーブル更新
                    update_tables();
                    // 画面更新
                    update_remote_videos();
                }, 1);
            } else if(message_obj.message == MUTE_MESSAGE) {
                // ミュート
                setTimeout(() => {
                    for(let user of other_users) {
                        if(user.name == message_obj.user_name) {
                            user.is_mute = true;
                        }
                    }
                    update_tables();
                }, 1);
            } else if(message_obj.message == UNMUTE_MESSAGE) {
                // ミュート解除
                setTimeout(() => {
                    for(let user of other_users) {
                        if(user.name == message_obj.user_name) {
                            user.is_mute = false;
                        }
                    }
                    update_tables();
                }, 1);
            } else if(message_obj.message == SHARE_START_MESSAGE) {
                // 共有開始
                setTimeout(async () => {
                    // このユーザーを共有状態にする
                    for(let user of other_users) {
                        if(user.name == message_obj.user_name) {
                            user.is_sharing_display = true;
                        }
                    }
                    if(own_user.is_sharing_display) {
                        // 自身の共有を解除する
                        // ボタン更新
                        update_share_display_button(false);
                        // 共有停止メッセージをルームに送る
                        send_message_to_talking_room(SHARE_STOP_MESSAGE);
                        // 共有停止処理
                        stop_share_display();
                        // 状態更新
                        own_user.is_sharing_display = false;
                    }
                    // テーブル更新
                    update_tables();
                    // 画面更新
                    update_remote_videos();
                }, 1);
            } else if(message_obj.message == SHARE_STOP_MESSAGE) {
                // 共有停止
                setTimeout(() => {
                    // このユーザーを非共有状態にする
                    for(let user of other_users) {
                        if(user.name == message_obj.user_name) {
                            user.is_sharing_display = false;
                        }
                    }
                    // テーブル更新
                    update_tables();
                    // 画面更新
                    update_remote_videos();
                }, 1);
            }
        });

        talking_room.on("close", function() {
            console.log(logPrefix, "I left from room.");

            // 全てのビデオを閉じる
            for(let video of $("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID).children()) {
                video.srcObject.getTracks().forEach(t => t.stop());
                video.srcObject = null;
            };
            $("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID).empty();
        });
    }

    var update_remote_videos = function() {
        let peer_id_to_video = {};
        for(let v of $("#"+TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID).children()) {
            peer_id_to_video[$(v).data("peerId")] = $(v);
        }

        let current_sharing_user_name = "";
        {
            let video = peer_id_to_video[own_user.peer_id];
            if(video != null) {
                if(own_user.is_sharing_display) {
                    video
                        .removeClass("remote-video-hidden")
                        .addClass("remote-video-shown");
                    current_sharing_user_name = own_user_name;
                } else {
                    video
                        .removeClass("remote-video-shown")
                        .addClass("remote-video-hidden");
                }
            }  
        }
        for(let user of other_users) {
            for(let peer_id in user.peer_id_to_joining_rooms) {
                let video = peer_id_to_video[peer_id];
                if(video != null) {
                    if(user.is_sharing_display) {
                        video
                            .removeClass("remote-video-hidden")
                            .addClass("remote-video-shown");
                        current_sharing_user_name = user.name;
                    } else {
                        video
                            .removeClass("remote-video-shown")
                            .addClass("remote-video-hidden");
                    }
                }
            }
        }

        // 今画面を共有しているユーザーの名前を表示
        if(current_sharing_user_name != "") {
            $("#"+TALK_SCREEN_SHARING_USER_NAME_TEXT_ID).show();
            $($("#"+TALK_SCREEN_SHARING_USER_NAME_TEXT_ID).children("div")[0]).text(current_sharing_user_name + "の画面");
            $("#"+TALK_SCREEN_REMOTE_VIDEOS_DESCRIPTION_ID).hide();
            // ミニ動画共有コンテナを表示
            $("#"+MINI_REMOTE_VIDEOS_CONTAINER_ID).show();
            $("#"+STRETCH_MINI_REMOTE_VIDEOS_ID).show();
        } else {
            $("#"+TALK_SCREEN_SHARING_USER_NAME_TEXT_ID).hide();
            $("#"+TALK_SCREEN_REMOTE_VIDEOS_DESCRIPTION_ID).show();
            // ミニ動画共有コンテナを非表示
            $("#"+MINI_REMOTE_VIDEOS_CONTAINER_ID).hide();
            $("#"+STRETCH_MINI_REMOTE_VIDEOS_ID).hide();
        }
    }

    // 待機ルームにメッセージを送る
    var send_message_to_waiting_room = function(message, optionals = null) {
        let message_obj = {
            message : message,
            user_name : own_user_name,
            peer_id : own_user.peer_id,
            joining_room : own_user.joining_room,
            invited_rooms : own_user.invited_rooms
        }
        if(optionals != null) {
            for(let key in optionals) {
                message_obj[key] = optionals[key];
            }
        }
        waiting_room?.send(JSON.stringify(message_obj));
    }

    // 会話ルームにメッセージを送る
    var send_message_to_talking_room = function(message) {
        let message_obj = {
            message : message,
            user_name : own_user_name,
            is_mute : own_user.is_mute,
            is_sharing_display : own_user.is_sharing_display,
            peer_id : own_user.peer_id
        }
        talking_room?.send(JSON.stringify(message_obj));
    }

    // 待機ルーム名を取得
    var get_waiting_room_name = function() {
        return "!room_" + window.location.host;
    }

    // ルーム名を新規作成する
    var create_room_name = function() {
        return "room_" + generate_uuid();
    }

    // ユーザーをルームに招待する
    var invite_users_to_room = function(user_names, room_name) {
        for(let user_name of user_names) {
            // 招待を送る
            send_message_to_waiting_room(INVITE_USER_MESSAGE, { target_user : user_name, room_name : room_name });
        }
    }

    // 通話を開始する
    var start_talking_async = async function(room_name) {
        // ユーザーリスト非表示
        hide_user_list();
        $("#"+SHOW_USERS_BUTTON_ID).hide();
        // オーディオをセットアップする
        let stream = await setup_audio_stream();
        if(stream == null) {
            // オーディオを開けなかったアラートを表示して終了
            show_mic_cancelled_alert();
            return;
        } 
        local_stream = stream;
        join_talking_room(room_name);
        // 自身のデータに部屋名を入力する
        own_user.joining_room = room_name;
        // マイクオン
        set_mute(false);
        // 画面共有オフ
        set_share_display_off();
        // 通話画面を最大化
        show_view_from_bottom_right($("#"+TALK_SCREEN_ID));
        // 共有画面を通話スクリーンのコンテナに移動
        dispose_mini_remote_videos();
        // 通話パレット表示
        $("#"+TALKING_PALETTE_ID).show();
        // データ送信
        send_message_to_waiting_room(UPDATE_USER_DATA_MESSAGE);
    }

    // 通話ボタンを押したとき
    var process_talk_button_async = async function() {
        // 自身の参加しているルームのチェック
        let has_room = false;
        for(let peer_id in own_other_peer_id_to_joining_rooms) {
            if(own_other_peer_id_to_joining_rooms[peer_id] != "") {
                has_room = true;
                break;
            }
        }
        if(own_user.joining_room != "" || has_room) {
            // ルーム参加済みの場合アラートを出してキャンセル
            show_room_existed_alert();
            return;
        }
        // 対象ユーザーを取得
        let target_users = get_selected_free_user_names();
        if(target_users.length == 0) return;
        let ret = await ask_start_talking_async(target_users);
        if(ret) {
            // 再度対象ユーザーを取得
            target_users = get_selected_free_user_names();
            if(target_users.length > 0) {
                // roomを作成する
                let room_name = create_room_name();
                // 通話スタート
                await start_talking_async(room_name);
                // ユーザーを招待する
                invite_users_to_room(target_users, room_name);
            }
            // 選択ユーザーをクリアする
            selected_user_names = [];
            update_tables();
        }
    }

    // ハングアップを押した時
    var process_hung_up_button = function() {
        if(talking_room != null) {
            // 会話ルームから出る
            console.log(logPrefix, "leave talking room...");
            talking_room.close();
            talking_room = null;
        }
        if(local_stream != null) {
            // ローカルストリームを閉じる
            console.log(logPrefix, "close local stream...");
            local_stream.getTracks().forEach(t => t.stop());
            local_stream = null;
        }
        if(display_stream != null) {
            // ディスプレイストリームを閉じる
            console.log(logPrefix, "close display stream...");
            display_stream.getTracks().forEach(t => t.stop());
            display_stream = null;
        }
        // 通話パレット非表示
        $("#"+TALKING_PALETTE_ID).hide();
        // ミニ画面共有コンテナ非表示
        $("#"+MINI_REMOTE_VIDEOS_CONTAINER_ID).hide();
        $("#"+STRETCH_MINI_REMOTE_VIDEOS_ID).hide();
        // 通話画面非表示
        hide_view_to_bottom_right($("#"+TALK_SCREEN_ID));
        // ユーザーリスト表示ボタンを表示
        $("#"+SHOW_USERS_BUTTON_ID).show();
        // 部屋情報を消去
        own_user.joining_room = "";
        // 更新送信
        send_message_to_waiting_room(UPDATE_USER_DATA_MESSAGE);
        // 選択ユーザーをクリアする
        selected_user_names = [];
        update_tables();
    }

    // 参加をリクエストボタンを押した時
    var process_request_joining_button = async function() {
        let target_users = get_selected_free_user_names();
        let ret = await ask_request_joining_async(target_users);
        if(ret) {
            target_users = get_selected_free_user_names();
            let room_name = own_user.joining_room;
            if(target_users.length > 0 && room_name != "") {
                // ユーザーを招待する
                invite_users_to_room(target_users, room_name);
            }
            // 選択ユーザーをクリアする
            selected_user_names = [];
            update_tables();
            // 参加者一覧に戻る
            $("#"+TALK_SCREEN_ADD_MEMBERS_CONTAINER_ID).hide();
            $("#"+TALK_SCREEN_MEMBERS_LIST_ID).show();
        }
    }

    // 選択ユーザーのうち、どこの部屋にも参加していないユーザーの名前を取得する
    var get_selected_free_user_names = function() {
        let other_user_names = [];
        other_users.forEach(a => {
            let has_rooms = false;
            for(let peer_id in a.peer_id_to_joining_rooms) {
                let joining_room = a.peer_id_to_joining_rooms[peer_id];
                if(joining_room != "") {
                    has_rooms = true;
                    break;
                }
            }
            if(!has_rooms) {
                other_user_names.push(a.name);
            }
        });
        return selected_user_names.filter(a => other_user_names.indexOf(a) >= 0);
    }

    // 通話、参加リクエストのボタン更新
    var update_request_buttons = function() {
        let existed_selected_users = get_selected_free_user_names();
        if(existed_selected_users.length > 0) {
            $("#"+REQUEST_TALKING_BUTTON_ID).show();
            $("#"+REQUEST_JOINING_BUTTON_ID).show();
            $($("#"+REQUEST_TALKING_BUTTON_ID).children("div")[0])
                .text("通話をリクエスト(" + existed_selected_users.length + ")");
            $($("#"+REQUEST_JOINING_BUTTON_ID).children("div")[0])
                .text("参加をリクエスト(" + existed_selected_users.length + ")");
        } else {
            $("#"+REQUEST_TALKING_BUTTON_ID).hide();
            $("#"+REQUEST_JOINING_BUTTON_ID).hide();
        }
    }

    // テーブルの更新
    var update_tables = function() {
        console.log(logPrefix, "update tables.")
        // 自身の部屋以外のユーザーを表示するテーブル
        let out_users_tables = [$("#"+USERS_TABLE_ID), $("#"+TALK_SCREEN_USERS_TABLE_ID)];
        // テーブルをクリア -> 少なくともChromeではスクロールは勝手に巻き戻らないので大丈夫そう。
        out_users_tables.forEach(t => t.empty());
        $("#"+ROOM_MEMBERS_TABLE_ID).empty();
        // ユーザー情報ごとにユーザーを区分けする
        let free_users = [];
        let in_other_room_users = [];
        let my_room_users = [];
        let invited_my_room_users = [];
        my_room_users.push(own_user);
        for(let user of other_users) {
            let user_joining_room = "";
            for(let peer_id in user.peer_id_to_joining_rooms) {
                let joining_room = user.peer_id_to_joining_rooms[peer_id];
                if(joining_room != "") {
                    user_joining_room = joining_room;
                    break;
                }
            }
            if(user_joining_room == "") {
                // 参加ルームなし
                free_users.push(user);
            } else if(user_joining_room == own_user.joining_room) {
                // 自分のルームにいる
                my_room_users.push(user);
            } else {
                // 自分のルームにいない
                in_other_room_users.push(user);
            }
            if(user.invited_rooms.indexOf(own_user.joining_room) >= 0) {
                // 自分のルームに誘っている
                invited_my_room_users.push(user);
            }
        }
        out_users_tables.forEach(table => {
            // 通話に参加していないユーザーをリストに入れていく
            for (let user of free_users) {
                if(table.attr("id") == TALK_SCREEN_USERS_TABLE_ID && user.invited_rooms.indexOf(own_user.joining_room) >= 0) {
                    // 通話画面では招待中のユーザーは表示させない
                    continue;
                }
                let tr = $("<tr>");
                let td = $("<td>").addClass("users-list-table-td").appendTo(tr);
                // 名前
                $("<div>").addClass("users-list-table-text")
                    .text(user.name)
                    .appendTo(td);
                // 選択中アイコン
                let checking_icon = $("<div>")
                    .addClass("users-list-table-checking-icon")
                    .appendTo(td)
                    .hide();
                // 選択済みアイコン
                let checked_icon = $("<div>")
                    .addClass("users-list-table-checked-icon")
                    .appendTo(td);
                // ユーザーが非選択の場合は選択済みアイコンを非表示にする
                if(selected_user_names.indexOf(user.name) < 0) {
                    checked_icon.hide();
                }

                // tdタグをホバーしたとき背景色を変更、選択中アイコンを表示する
                td.css("cursor", "pointer")
                td.hover(function(e) {
                    td.css("background-color", "rgba(0, 0, 0, .04)")
                    checking_icon.show();
                }, function(e) {
                    td.css("background-color", "")
                    checking_icon.hide();
                });

                // tdタグをクリックした時、選択/非選択を入れ替える
                td.click(function() {
                    if(selected_user_names.indexOf(user.name) >= 0) {
                        // 選択を外す
                        selected_user_names = selected_user_names.filter(a => a != user.name);
                        checked_icon.hide();
                    } else {
                        // 選択をする
                        selected_user_names.push(user.name);
                        checked_icon.show();
                    }
                    update_request_buttons();
                });
                tr.appendTo(table);
            }
            // 他の人と通話中のユーザー
            for (let user of in_other_room_users) {
                let tr = $("<tr>");
                let td = $("<td>").addClass("users-list-table-td").appendTo(tr);
                // 名前
                $("<div>").addClass("users-list-table-text-disabled")
                    .text(user.name)
                    .appendTo(td);
                // 通話中アイコン
                $("<div>")
                    .addClass("users-list-table-talking-icon")
                    .appendTo(td);
                tr.appendTo(table);
            }
        });
        // 自分と通話中のユーザー
        for (let user of my_room_users) {
            let tr = $("<tr>");
            let td = $("<td>").addClass("users-list-table-td").appendTo(tr);
            // 名前
            $("<div>").addClass("users-list-table-text-in-room")
                .text(user.name)
                .appendTo(td);
            if(user.is_mute) {
                // ミュートアイコン
                $("<div>")
                    .addClass("users-list-table-mute-icon")
                    .appendTo(td)
                    .css("right", user.is_sharing_display ? "30px" : "");
            }
            if(user.is_sharing_display) {
                // 画面共有アイコン
                $("<div>")
                    .addClass("users-list-table-share-display-icon")
                    .appendTo(td);
            }
            tr.appendTo($("#"+ROOM_MEMBERS_TABLE_ID));
        }
        if(invited_my_room_users.length > 0) {
            {
                // セパレータ
                let tr = $("<tr>");
                let td = $("<td>").addClass("users-list-table-td").appendTo(tr);
                $("<hr>").addClass("users-list-table-hr").appendTo(td);
                tr.appendTo($("#"+ROOM_MEMBERS_TABLE_ID));
            }
            {
                // リクエスト済み(num)
                let tr = $("<tr>");
                let td = $("<td>").addClass("users-list-table-td").appendTo(tr);
                $("<div>").addClass("users-list-table-text")
                    .text("リクエスト済み(" + invited_my_room_users.length + ")")
                    .css("color", "#5D5D5D").css("font-weight", "bold")
                    .appendTo(td);
                tr.appendTo($("#"+ROOM_MEMBERS_TABLE_ID));
            }
            for (let user of invited_my_room_users) {
                // 名前
                let tr = $("<tr>");
                let td = $("<td>").addClass("users-list-table-td").appendTo(tr);
                $("<div>").addClass("users-list-table-text-in-room")
                    .text(user.name)
                    .appendTo(td);
                tr.appendTo($("#"+ROOM_MEMBERS_TABLE_ID));
            }
        }

        // ボタンを更新
        update_request_buttons();
    }

    // ユーザーリストダイアログ作成
    var create_user_list_dialog = function() {
        let dialog = $("<div>").addClass("user-list-dialog");
        setup_move_and_resize_dialog(dialog)

        // ユーザーリストのテーブル
        let user_list_table_container = $("<div>").addClass("dialog-list-container").appendTo(dialog);
        $("<table>")
            .attr("id", USERS_TABLE_ID)
            .addClass("users-list-table")
            .appendTo(user_list_table_container);

        // 通話リクエストボタン(無効)
        let request_button_disabled = $("<div>")
            .addClass("request-talking-button-disabled")
            .appendTo(dialog);
        $("<div>").addClass("button-text-white")
            .text("通話をリクエスト")
            .appendTo(request_button_disabled);

        // 通話リクエストボタン
        let request_button = $("<div>")
            .attr("id", REQUEST_TALKING_BUTTON_ID)
            .addClass("request-talking-button")
            .appendTo(dialog)
            .hide()
            .click(function(e) {
                invoke_async_process(async function() {
                    await process_talk_button_async();
                });
            });
        $("<div>").addClass("button-text-white")
            .text("通話をリクエスト")
            .appendTo(request_button);

        return dialog;
    }

    // 通話パレット作成
    var create_talking_palette = function() {
        let div = $("<div>").addClass("talking-palette");
        let container = $("<div>").addClass("talking-palette-tools-container").appendTo(div);
        $("<div>")
            .attr("id", TALKING_PALETTE_MUTE_BUTTON_ID)
            .addClass("mic-off-button-talking-palette")
            .attr("title", "マイクをオフ")
            .appendTo(container)
            .click(() => set_mute(true));
        $("<div>")
            .attr("id", TALKING_PALETTE_UNMUTE_BUTTON_ID)
            .addClass("mic-on-button-talking-palette")
            .attr("title", "マイクをオン")
            .appendTo(container)
            .hide()
            .click(() => set_mute(false));
        $("<div>")
            .attr("id", TALKING_PALETTE_STOP_SHARE_DISPLAY_ID)
            .addClass("share-display-button-talking-palette")
            .attr("title", "画面共有を停止")
            .appendTo(container)
            .hide()
            .click(set_share_display_off);
        $("<div>")
            .addClass("hung-up-button-talking-palette")
            .attr("title", "通話を切る")
            .appendTo(container)
            .click(process_hung_up_button);
        $("<div>")
            .addClass("spacing-talking-palette")
            .appendTo(container);
        $("<div>")
            .addClass("maximize-button-talking-palette")
            .appendTo(container)
            .attr("title", "通話画面を最大化")
            .click(function(e) {
                invoke_async_process(async () => {
                    if(own_user.is_sharing_display) {
                        // 画面共有中の場合は共有をやめるか聞く
                        let ret = await ask_stop_sharing_for_showing_talk_screen_async();
                        if(!ret) return;
                        // 共有停止
                        set_share_display_off();
                    }
                    // 通話スクリーンを表示する
                    show_view_from_bottom_right($("#"+TALK_SCREEN_ID));
                    // 共有画面を通話スクリーンのコンテナに移動
                    dispose_mini_remote_videos();
                });
            });
        return div;
    }

    // ミニ画像表示コンテナ作成
    var create_mini_remote_videos_container = function() {
        let container = $("<div>")
            .addClass("mini-remote-videos-container");
        let maximize_button = $("<div>")
            .attr("title", "通話画面を最大化")
            .addClass("maximize-screen-button")
            .appendTo(container)
            .click(function() {
                invoke_async_process(async () => {
                    if(own_user.is_sharing_display) {
                        // 画面共有中の場合は共有をやめるか聞く
                        let ret = await ask_stop_sharing_for_showing_talk_screen_async();
                        if(!ret) return;
                        // 共有停止
                        set_share_display_off();
                    }
                    // 通話スクリーンを表示する
                    show_view_from_bottom_right($("#"+TALK_SCREEN_ID));
                    // 共有画面を通話スクリーンのコンテナに移動
                    dispose_mini_remote_videos();
                });
            })
            .hide();
        let minimize_button = $("<div>")
            .attr("title", "画面共有をたたむ")
            .addClass("minimize-screen-button")
            .appendTo(container)
            .click(function() {
                $("#"+MINI_REMOTE_VIDEOS_CONTAINER_ID).animate({
                    width: "0px"
                }, 250, "swing", function() {
                    $("#"+STRETCH_MINI_REMOTE_VIDEOS_ID).css("width", "");
                });
            })
            .hide();
        container.hover(function() {
            maximize_button.show();
            minimize_button.show();
        }, function() {
            maximize_button.hide();
            minimize_button.hide();
        });
        return container;
    }

    // 通話スクリーン内のメンバーウィンドウ作成
    var create_member_window = function () {
        let div = $("<div>").addClass("member-list-view-talk-screen");
        let inner_div = $("<div>").addClass("member-list-view-talk-screen-inner").appendTo(div);

        {
            // 参加者一覧
            let container = $("<div>")
                .attr("id", TALK_SCREEN_MEMBERS_LIST_ID)
                .appendTo(inner_div);

            // キャプション
            $("<div>").addClass("window-caption")
                .text("参加者")
                .appendTo(container);

            // クローズボタン
            $("<div>").addClass("member-window-close-button")
                .appendTo(container)
                .click(hide_member_window_on_talk_screen);

            // ルームメンバーリストテーブル
            let list_container = $("<div>").addClass("window-table-container").appendTo(container);
            $("<table>").attr("id", ROOM_MEMBERS_TABLE_ID).addClass("users-list-table").appendTo(list_container);

            // 参加者を追加ボタン
            let add_member_button = $("<div>")
                .addClass("add-member-button")
                .appendTo(container)
                .click(function(e) {
                    $("#"+TALK_SCREEN_MEMBERS_LIST_ID).hide();
                    $("#"+TALK_SCREEN_ADD_MEMBERS_CONTAINER_ID).show();
                });
            $("<div>").addClass("icon-button-text")
                .text("参加者を追加")
                .appendTo(add_member_button);
        }

        {
            // 参加者を追加
            let container = $("<div>")
                .attr("id", TALK_SCREEN_ADD_MEMBERS_CONTAINER_ID)
                .appendTo(inner_div);

            // キャプション
            $("<div>").addClass("window-caption-padding")
                .text("参加者を追加")
                .appendTo(container);

            // バックボタン
            $("<div>").addClass("member-window-back-button")
                .appendTo(container)
                .click(function(e) {
                    $("#"+TALK_SCREEN_ADD_MEMBERS_CONTAINER_ID).hide();
                    $("#"+TALK_SCREEN_MEMBERS_LIST_ID).show();
                    // 選択ユーザーをクリアする
                    selected_user_names = [];
                    update_tables();
                });

            // クローズボタン
            $("<div>").addClass("member-window-close-button")
                .appendTo(container)
                .click(hide_member_window_on_talk_screen);

            // ユーザーリストテーブル
            let list_container = $("<div>").addClass("window-table-container").appendTo(container);
            $("<table>").attr("id", TALK_SCREEN_USERS_TABLE_ID).addClass("users-list-table").appendTo(list_container);

            // 参加リクエストボタン(無効)
            let request_button_disabled = $("<div>")
                .addClass("request-joining-button-disabled")
                .appendTo(container);
            $("<div>").addClass("button-text-white")
                .text("参加をリクエスト")
                .appendTo(request_button_disabled);

            // 参加リクエストボタン
            let button = $("<div>")
                .attr("id", REQUEST_JOINING_BUTTON_ID)
                .addClass("request-joining-button")
                .appendTo(container)
                .hide()
                .click(process_request_joining_button);
            $("<div>").addClass("button-text-white")
                .text("参加をリクエスト")
                .appendTo(button);

            container.hide();
        }

        return div;
    }

    // 通話スクリーンのメンバーウィンドウ表示
    var show_member_window_on_talk_screen = function() {
        $("#"+TALK_SCREEN_MEMBERS_WINDOW_ID).show();
        $("#"+TALK_SCREEN_MEMBERS_WINDOW_ID).animate({
            width: "248px"
        }, 250, "swing", function() {
            $("#"+TALK_SCREEN_SHOW_MEMBERS_BUTTON_ID).hide();
            $("#"+TALK_SCREEN_HIDE_MEMBERS_BUTTON_ID).show();
        });
    }

    // 通話スクリーンのメンバーウィンドウを隠す
    var hide_member_window_on_talk_screen = function() {
        $("#"+TALK_SCREEN_MEMBERS_WINDOW_ID).animate({
            width: "0"
        }, 250, "swing", function() {
            $("#"+TALK_SCREEN_MEMBERS_WINDOW_ID).hide();
            $("#"+TALK_SCREEN_HIDE_MEMBERS_BUTTON_ID).hide();
            $("#"+TALK_SCREEN_SHOW_MEMBERS_BUTTON_ID).show();
        });
    }

    // 通話スクリーン作成
    var create_talk_screen = function() {
        let bg = $("<div>").addClass("talk-screen-bg-mask");
        // メンバーリスト、画面共有ビューのコンテナ
        let container = $("<div>").addClass("view-container-talk-screen").appendTo(bg);
        // リモートビデオコンテナ
        let remote_videos_area_outer = $("<div>")
            .addClass("remote-videos-area-outer")
            .appendTo(container);
        let remote_videos_area = $("<div>")
            .addClass("remote-videos-area")
            .appendTo(remote_videos_area_outer);
        let description_container = $("<div>")
            .addClass("remote-videos-area-child")
            .appendTo(remote_videos_area);
        $("<div>")
            .attr("id", TALK_SCREEN_REMOTE_VIDEOS_DESCRIPTION_ID)
            .addClass("remote-videos-description")
            .text("画面共有が開始されるとここに表示されます。")
            .appendTo(description_container);
        let remote_videos_container_outer = $("<div>")
            .attr("id", TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_OUTER_ID)
            .addClass("remote-videos-area-child")
            .appendTo(remote_videos_area);
        $("<div>")
            .attr("id", TALK_SCREEN_REMOTE_VIDEOS_CONTAINER_ID)
            .addClass("remote-videos-container")
            .appendTo(remote_videos_container_outer);
        // メンバーウィンドウ
        create_member_window()
            .attr("id", TALK_SCREEN_MEMBERS_WINDOW_ID)
            .appendTo(container)
            .hide();
        // リモートビデオの共有者表示
        let text_container = $("<div>")
            .attr("id", TALK_SCREEN_SHARING_USER_NAME_TEXT_ID)
            .addClass("sharing-user-name-text-container")
            .appendTo(bg)
            .hide();
        $("<div>")
            .addClass("sharing-user-name-text")
            .text("の画面")
            .appendTo(text_container);
        // 最小化
        $("<div>").addClass("close-talk-button")
            .click(function() {
                // 通話スクリーンをしまう
                hide_view_to_bottom_right(bg);
                // ミニ動画共有コンテナセットアップ
                setup_mini_remote_videos();
            })
            .attr("title", "通話画面を最小化")
            .appendTo(bg);
        // マイクOFF
        $("<div>").addClass("mic-off-button")
            .attr("id", TALK_SCREEN_MUTE_BUTTON_ID)
            .attr("title", "マイクをオフ")
            .appendTo(bg)
            .click(() => set_mute(true));
        // マイクON
        $("<div>").addClass("mic-on-button")
            .attr("id", TALK_SCREEN_UNMUTE_BUTTON_ID)
            .attr("title", "マイクをオン")
            .appendTo(bg)
            .hide()
            .click(() => set_mute(false));
        // 共有開始
        $("<div>").addClass("share-display-button")
            .attr("id", TALK_SCREEN_START_SHARE_DISPLAY_ID)
            .attr("title", "画面を共有")
            .appendTo(bg)
            .click(function(e) {
                invoke_async_process(async function() {
                    await set_share_display_on_async();
                });
            });
        // 共有停止
        $("<div>").addClass("stop-share-display-button")
            .attr("id", TALK_SCREEN_STOP_SHARE_DISPLAY_ID)
            .attr("title", "画面共有を停止")
            .appendTo(bg)
            .click(set_share_display_off)
            .hide();
        // 退室
        $("<div>").addClass("hang-up-button")
            .attr("title", "通話を切る")
            .appendTo(bg)
            .click(process_hung_up_button);
        // メンバー表示・非表示
        $("<div>").addClass("hide-members-button")
            .attr("id", TALK_SCREEN_HIDE_MEMBERS_BUTTON_ID)
            .attr("title", "メンバーを非表示")
            .click(hide_member_window_on_talk_screen)
            .appendTo(bg)
            .hide();
        $("<div>").addClass("show-members-button")
            .attr("id", TALK_SCREEN_SHOW_MEMBERS_BUTTON_ID)
            .attr("title", "メンバーを表示")
            .click(show_member_window_on_talk_screen)
            .appendTo(bg);
        return bg;
    }

    // 待機ルームに入る
    var join_waiting_room = function(room_name) {
        waiting_room = peer.joinRoom(room_name, {
            mode: params.nbwhisper_room_mode_for_waiting_room
        });
        if(waiting_room == null) {
            console.log(logPrefix, "cannot create room...");
        }

        waiting_room.once("open", function() {
            console.log(logPrefix, "waiting room open")
            // メンバーにユーザー情報を送信
            send_message_to_waiting_room(UPDATE_USER_DATA_MESSAGE);
        });

        waiting_room.on("peerJoin", function(peer_id) {
            console.log(logPrefix, "waiting peer joined to room: " + peer_id);
        });

        waiting_room.on("peerLeave", function(peer_id) {
            console.log(logPrefix, "waiting peer left from room: " + peer_id);
            // このpeer_idに限らず、ルームに参加していないpeer_idは全て削除する。
            // ユーザー更新
            for(let temp_peer_id in own_other_peer_id_to_joining_rooms) {
                if(temp_peer_id == peer_id || !(temp_peer_id in waiting_room.members))
                   delete own_other_peer_id_to_joining_rooms.temp_peer_id;
            }
            let remove_users = [];
            for(let user of other_users) {
                for(let temp_peer_id in user.peer_id_to_joining_rooms) {
                    if(temp_peer_id == peer_id || !(temp_peer_id in waiting_room.members))
                        delete user.peer_id_to_joining_rooms[temp_peer_id];
                }
                if(Object.keys(user.peer_id_to_joining_rooms).length == 0) {
                    // ユーザーが一つもPeerIdを持たなくなったので削除する
                    remove_users.push(user);
                }
            }
            other_users = other_users.filter(a => remove_users.indexOf(a) < 0);
            update_tables();
        });

        waiting_room.on("data", function(data) {
            if(data == null) return;
            let message_obj = JSON.parse(data.data);
            let peer_id = data.src;
            console.log(logPrefix, "waiting meesage from: " + peer_id);
            console.log(logPrefix, message_obj);

            if(message_obj.message == UPDATE_USER_DATA_MESSAGE || message_obj.message == UPDATE_USER_DATA_RESPONSE_MESSAGE) {
                if(message_obj.message == UPDATE_USER_DATA_MESSAGE) {
                    // レスポンスする: この処理で新規メンバーにも自身の情報が伝わる
                    send_message_to_waiting_room(UPDATE_USER_DATA_RESPONSE_MESSAGE);
                }
                setTimeout(() => {
                    // 情報更新
                    update_other_user(peer_id, message_obj);
                }, 1);
            } else if(message_obj.message == INVITE_USER_MESSAGE) {
                // 招待を送られた
                if(message_obj.target_user != own_user_name) {
                    // 自分への招待ではない
                    return;
                }
                console.log(logPrefix, "invited room: " + message_obj.room_name + " from: " + message_obj.user_name);
                own_user.invited_rooms.push(message_obj.room_name);
                // データ更新を送信
                send_message_to_waiting_room(UPDATE_USER_DATA_MESSAGE);
                setTimeout(() => {
                    // 情報更新
                    update_other_user(peer_id, message_obj);
                }, 1);
                // キューに招待メッセージデータを追加
                invitaions_queue.push(message_obj);
                if(!is_processing_invitaions_queue) {
                    process_invitations_queue();
                }
            }
        });

        waiting_room.on("close", function() {
            console.log(logPrefix, "I left from waiting room.");
            if(!is_page_unloading) {
                // ページアンロード中以外でここに来たらアラート
                alert("NBWhisperの接続が切断されました。このページを再読み込みしてください。");
            }
        });
    }

    // 情報を更新する
    var update_other_user = function(peer_id, message_obj) {
        if(message_obj.user_name == own_user_name) {
            // 自身の場合は自身の情報を更新する
            own_other_peer_id_to_joining_rooms[peer_id] = message_obj.joining_room;
            return;
        }
        let existed_index = -1;
        for(let i = 0; i < other_users.length; ++i) {
            if(other_users[i].name == message_obj.user_name) {
                existed_index = i;
                break;
            }
        }
        if(existed_index >= 0) {
            // 更新
            other_users[existed_index].peer_id_to_joining_rooms[peer_id] = message_obj.joining_room;
            other_users[existed_index].invited_rooms = message_obj.invited_rooms;
        } else {
            // 追加
            let new_user = {
                name : message_obj.user_name,
                is_mute : false,
                is_sharing_display : false,
                peer_id_to_joining_rooms : {},
                invited_rooms : message_obj.invited_rooms 
            }
            new_user.peer_id_to_joining_rooms[peer_id] = message_obj.joining_room;
            other_users.push(new_user);
        }
        update_tables();    
    }

    // 招待の処理のキューを処理する
    var invitaions_queue = [];                      // 処理する招待のキュー
    var is_processing_invitaions_queue = false;     // 招待キューを処理中のフラグ
    var process_invitations_queue = function() {
        if(invitaions_queue.length > 0) {
            is_processing_invitaions_queue = true;
            let message_obj = invitaions_queue.shift();
            setTimeout(async () => {
                await process_invitation_async(message_obj);
                // 処理が終了したら次の処理
                process_invitations_queue();
            }, 1);
        } else {
            // キューがなくなったら何もしない
            console.log(logPrefix, "process_invitations_queue has finished.");
            is_processing_invitaions_queue = false;
        }
    }

    // 招待を処理する
    var process_invitation_async = async function(message_obj) {
        // ルームメンバーの取得
        let room_members = [];
        for(let user of other_users) {
            if(user.joining_room == message_obj.room_name) room_members.push(user.name);
        }
        // 招待を受けるか？
        if(await ask_accept_talking(message_obj.user_name, room_members)) {
            // 招待を消去する
            own_user.invited_rooms = own_user.invited_rooms.filter(r => r != message_obj.room_name);
            // 部屋が存在するか確認する
            let exists_room = false;
            for(let user of other_users) {
                if(user.name == message_obj.user_name) {
                    if(message_obj.peer_id in user.peer_id_to_joining_rooms) {
                        exists_room = user.peer_id_to_joining_rooms[message_obj.peer_id] == message_obj.room_name;
                        break;
                    }
                }
            }
            if(exists_room) {
                // 自身がほかのタブ・ウィンドウでルームに参加済みか確認する
                let has_room = false;
                for(let peer_id in own_other_peer_id_to_joining_rooms) {
                    if(own_other_peer_id_to_joining_rooms[peer_id] != "") {
                        has_room = true;
                        break;
                    }
                }
                if(!has_room) {
                    // 通話を開始する
                    await start_talking_async(message_obj.room_name);
                    // データ更新を送信
                    send_message_to_waiting_room(UPDATE_USER_DATA_MESSAGE);
                } else {
                    // データ更新を送信
                    send_message_to_waiting_room(UPDATE_USER_DATA_MESSAGE);
                    // 参加済みなのでアラート表示
                    show_room_existed_alert();
                }
            } else {
                // データ更新を送信
                send_message_to_waiting_room(UPDATE_USER_DATA_MESSAGE);
                // 通話がないため招待無効のアラート表示
                show_unavailable_invitation_with_finished_talk_alert();
            }
        } else {
            // 招待を消去する
            own_user.invited_rooms = own_user.invited_rooms.filter(r => r != message_obj.room_name);
            // データ更新を送信
            send_message_to_waiting_room(UPDATE_USER_DATA_MESSAGE);
        }
    }

    // 参加する
    const join = function () {
        // 待機ルームに入る
        const waiting_room_name = get_waiting_room_name();
        console.log(logPrefix, "待機ルーム: " + waiting_room_name);
        join_waiting_room(waiting_room_name);
    }

    // 初期化前処理
    const pre_initialize = async function() {
        // パラメータ初期化
        await configure();
        // Peerを作成する
        try {
            await setup_peer();
        } catch(e) {
            alert(e.toString());
            throw e;
        }
    }
        
    // 初期化
    const initialize_panel = function() {
        $("<div>").attr("id", ELEMENT_ID).appendTo($(document.body));

        // ユーザーリスト表示ボタン
        $("<div>")
            .attr("id", SHOW_USERS_BUTTON_ID)
            .addClass("show-list-button")
            .click(show_user_list)
            .attr("title", "ユーザーを表示")
            .appendTo($("#"+ELEMENT_ID));

        // ユーザーリスト非表示ボタン
        $("<div>")
            .attr("id", HIDE_USERS_BUTTON_ID)
            .addClass("hide-list-button")
            .click(hide_user_list)
            .attr("title", "ユーザーを非表示")
            .appendTo($("#"+ELEMENT_ID))
            .hide();

        // ユーザーリスト
        create_user_list_dialog()
            .attr("id", USERS_LIST_DIALOG_ID)
            .appendTo($("#"+ELEMENT_ID))
            .hide();

        // 通話パレット
        create_talking_palette()
            .attr("id", TALKING_PALETTE_ID)
            .appendTo($("#"+ELEMENT_ID))
            .hide();

        // ミニ画面共有コンテナ
        create_mini_remote_videos_container()
            .attr("id", MINI_REMOTE_VIDEOS_CONTAINER_ID)
            .appendTo("#"+ELEMENT_ID)
            .hide();

        // ミニ画面共有コンテナを開くボタン
        $("<div>")
            .attr("id", STRETCH_MINI_REMOTE_VIDEOS_ID)
            .addClass("stretch-screen-button")
            .appendTo("#"+ELEMENT_ID)
            .click(function() {
                $("#"+MINI_REMOTE_VIDEOS_CONTAINER_ID).animate({
                    width: "256px"
                }, 250, "swing", function() {
                    $("#"+STRETCH_MINI_REMOTE_VIDEOS_ID).css("width", "0px");
                });
            })
            .css("width", "0px")
            .hide();

        // 通話画面
        create_talk_screen()
            .attr("id", TALK_SCREEN_ID)
            .appendTo($("#"+ELEMENT_ID))
            .hide();

        // ダミー映像ストリームキャンバス
        create_dummy_video_canvas()
            .attr("id", DUMMY_VIDEO_CANVAS_ID)
            .appendTo($("#"+ELEMENT_ID));
    }

    const load_extension = async function() {
        console.log(logPrefix, "NBWhisper starting...");
        load_css('./main.css');
        Peer = await load_js_async("https://cdn.webrtc.ecl.ntt.com/skyway-4.4.5.min.js");
        await pre_initialize();
        initialize_panel();

        join();
        console.log(logPrefix, "NBWhisper started.");
    };

    // ページ離脱時
    $(window).on('beforeunload', function() {
        console.log(logPrefix, "page is closed.")
        is_page_unloading = true;
        if(talking_room != null) {
            // 会話ルームから出る
            console.log(logPrefix, "leave talking room...");
            talking_room.close();
            talking_room = null;
        }
        if(local_stream != null) {
            // ローカルストリームを閉じる
            console.log(logPrefix, "close local stream...");
            local_stream.getTracks().forEach(t => t.stop());
            local_stream = null;
        }
        if(display_stream != null) {
            // ディスプレイストリームを閉じる
            console.log(logPrefix, "close display stream...");
            display_stream.getTracks().forEach(t => t.stop());
            display_stream = null;
        }
        if(waiting_room != null) {
            // 待機ルームから出る
            console.log(logPrefix, "leave talking room...");
            waiting_room.close();
            waiting_room = null;
        }
        if(peer != null) {
            // peerを閉じる
            console.log(logPrefix, "destory peer...");
            peer.destroy();
            peer = null;
            own_user.peer_id = null;
        }
    });

    var extension = {
        load_ipython_extension : load_extension
    };
    return extension;
});
