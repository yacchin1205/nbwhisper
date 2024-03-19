import * as React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { User } from './user';
import { Signal } from '@lumino/signaling';
import { UserState } from './userState';

// 通話リクエストの通知
export class RequestTalkingWidget extends ReactWidget {

    private _ownUser : User;

    private _body : string = "";
    private _subBody1 : string = "";
    private _subBody2 : string = "";

    public onDesideRequest = new Signal<RequestTalkingWidget, boolean>(this);

    constructor(ownUser : User) {
        super();
        this._ownUser = ownUser;
    }

    public setup(userName : string, targetUserNames : string[], joiningUserNames : string[]) {
        this._body = `${userName}から通話への参加リクエストが届きました。参加しますか？`;
        this._subBody1 = `${targetUserNames.length}名にリクエスト中 :\n` + targetUserNames.join(", ");
        if(joiningUserNames.length > 0) {
            this._subBody2 =  `${joiningUserNames.length}名が参加中です :\n` + joiningUserNames.join(", ");
        } else {
            this._subBody2 = "";
        }
    }

    private _desideRequest(isOk : boolean) {
        this.onDesideRequest.emit(isOk);
    }

    render(): JSX.Element {
        return (
            <div>
                { 
                    this._ownUser.getState() == UserState.Invited && 
                    <div className='nbwhisper-overlay'>
                        <div className='nbwhisper-dialog-base'>
                            {
                                this._body != "" &&
                                <div className='nbwhisper-dialog-body'>
                                    { this._body }
                                </div>
                            }
                            {
                                this._subBody1 != "" &&
                                <div className='nbwhisper-dialog-subbody'>
                                    { this._subBody1 }
                                </div>
                            }
                            {
                                this._subBody2 != "" &&
                                <div className='nbwhisper-dialog-subbody'>
                                    { this._subBody2 }
                                </div>
                            }
                            <div className='nbwhisper-dialog-buttons'>
                                <div 
                                    className={'nbwhisper-button nbwhisper-button-not-join'}
                                    onClick={() => this._desideRequest(false)}
                                >
                                    <span className='nbwhisper-button-not-join-icon' />
                                    <span className='nbwhisper-button-not-join-text'>参加しない</span>
                                </div>         
                                <div 
                                    className={'nbwhisper-button nbwhisper-button-join'}
                                    onClick={() => this._desideRequest(true)}
                                >
                                    <span className='nbwhisper-button-join-icon' />
                                    <span className='nbwhisper-button-join-text'>参加</span>
                                </div>
                            </div>
                        </div>
                    </div> 
                }
            </div>
        );
    }
}