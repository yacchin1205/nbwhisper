import * as React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';

export const DialogStyle = {
    Plain:  1,
    Join:   2
} as const;

export type DialogStyle = typeof DialogStyle[keyof typeof DialogStyle]

export interface IAskDialogOptions {
    body : string;
    subBody1 : string;
    subBody2 : string;
    ok : string;
    cancel : string;
    style : DialogStyle;
}

// ダイアログ類
export class DialogWidget extends ReactWidget {
    private _isDialogVisible = false;
    private _body = "";
    private _subBody1 = "";
    private _subBody2 = "";
    private _ok = "";
    private _cancel = "";
    private _style : DialogStyle = DialogStyle.Plain;
    private _resolve : any;

    constructor() {
        super();
    }

    showAskDialog(options : IAskDialogOptions) {
        this._isDialogVisible = true;
        this._body = options.body;
        this._subBody1 = options.subBody1;
        this._subBody2 = options.subBody2;
        this._ok = options.ok;
        this._cancel = options.cancel;
        this._style = options.style;
        this.update();
        return new Promise<boolean>(resolve => {
            this._resolve = resolve;
        });
    }

    _hideDialog() {
        this._isDialogVisible = false;
        this._body = "";
        this._subBody1 = "";
        this._subBody2 = "";
        this._ok = "";
        this._cancel = "";
        this.update();
    }

    _onOk() {
        this._resolve(true);
    }

    _onCancel() {
        this._resolve(false);
    }

    render(): JSX.Element {
        return (
            <div>
                { 
                    this._isDialogVisible && 
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
                                {
                                    this._cancel != "" && this._style == DialogStyle.Plain &&
                                    <div 
                                        className={'nbwhisper-button nbwhisper-button-cancel'}
                                        onClick={() => {
                                            this._hideDialog();
                                            this._onCancel();
                                        }}
                                    >
                                        <span>{ this._cancel }</span>
                                    </div>                    
                                }
                                {
                                    this._cancel != "" && this._style == DialogStyle.Join &&
                                    <div 
                                        className={'nbwhisper-button nbwhisper-button-not-join'}
                                        onClick={() => {
                                            this._hideDialog();
                                            this._onCancel();
                                        }}
                                    >
                                        <span className='nbwhisper-button-not-join-icon' />
                                        <span className='nbwhisper-button-not-join-text'>{ this._cancel }</span>
                                    </div>                    
                                }
                                {
                                    this._ok != "" && this._style == DialogStyle.Plain &&
                                    <div 
                                        className={'nbwhisper-button nbwhisper-button-normal'}
                                        onClick={() => {
                                            this._hideDialog();
                                            this._onOk();
                                        }}
                                    >
                                        <span>{ this._ok }</span>
                                    </div>
                                }
                                {
                                    this._ok != "" && this._style == DialogStyle.Join &&
                                    <div 
                                        className={'nbwhisper-button nbwhisper-button-join'}
                                        onClick={() => {
                                            this._hideDialog();
                                            this._onOk();
                                        }}
                                    >
                                        <span className='nbwhisper-button-join-icon' />
                                        <span className='nbwhisper-button-join-text'>{ this._ok }</span>
                                    </div>
                                }
                            </div>
                        </div>
                    </div> 
                }
            </div>
        );
    }
}