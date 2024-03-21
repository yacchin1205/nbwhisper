import * as React from 'react';
import { User } from './user';
import { ReactWidget } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';
import { WaitingUserList } from './waitingUserList';
import Draggable from 'react-draggable';
import Enumerable from 'linq';

// 待機ユーザーリスト表示ボタン
export function WaitingUserListButton({
    isListVisible,
    onClick
} : {
    isListVisible : boolean,
    onClick : () => void,
}) : JSX.Element {
    return (
        <div 
            className={`nbwhisper-waiting-user-list-button 
                ${
                    isListVisible ? 
                        "nbwhisper-waiting-user-list-button-close" : 
                        "nbwhisper-waiting-user-list-button-open"
                }`}
            onClick={onClick}
        >
        </div>
    );
}

// 通話リクエストボタン
export function RequestTalkingButton({
    targetNumber,
    onClick
} : {
    targetNumber: number,
    onClick : () => void,
}) : JSX.Element {
    return (
        <div 
            className={`nbwhisper-request-talking-button nbwhisper-button
                ${
                    targetNumber > 0 ? 
                        "nbwhisper-button-normal" : 
                        "nbwhisper-button-disabled"
                }`}
            onClick={targetNumber > 0 ? onClick : () => {}}
        >
            <span>通話をリクエスト{ targetNumber > 0 && `(${targetNumber})`}</span>
        </div>
    );
}

// 待機ユーザーリストウィジェット
export class WaitingUserListWidget extends ReactWidget {
    
    private _isListVisible = false;
    private _users : User[];

    public onRequestTalking = new Signal<WaitingUserListWidget, User[]>(this);

    constructor(users : User[]) {
        super();
        this._users = users;
    }

    setListVisible(value : boolean) {
        this._isListVisible = value;
        console.log(this._users);
        this.update();
    }

    _requestTalking() {
        let users = Enumerable.from(this._users).where(u => u.is_selected).toArray();
        if(users.length > 0) {
            this.onRequestTalking.emit(users);
        }
    }

    _onSelectUser(user : User) {
        user.is_selected = !user.is_selected;
        this.update();
    }

    render(): JSX.Element {
        return (
            <div className='nbwhisper-waiting-user-list-widget'>
                <Draggable>
                    <div>
                        <WaitingUserListButton 
                            isListVisible={this._isListVisible}
                            onClick={() => this.setListVisible(!this._isListVisible)}
                        />
                        { 
                            this._isListVisible && 
                            <div className='nbwhisper-waiting-user-list-dialog'>
                                <WaitingUserList 
                                    users={this._users}
                                    onSelect={(user) => this._onSelectUser(user)}
                                    optionalClassName='nbwhisper-waiting-user-list-container'
                                />
                                <RequestTalkingButton
                                    targetNumber={Enumerable.from(this._users).where(u => u.is_selected).count()}
                                    onClick={() => this._requestTalking()}
                                />
                            </div>
                        }
                    </div>
                </Draggable>
            </div>
        );
    }
}