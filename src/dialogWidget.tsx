import * as React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';

export interface IAskDialogOptions {
    body : string;
    subBody : string;
    ok : string;
    cancel : string;
}

// ダイアログ類
export class DialogWidget extends ReactWidget {
    private _isDialogVisible = false;
    private _body = "";
    private _subBody = "";
    private _ok = "";
    private _cancel = "";
    private _resolve : any;

    constructor() {
        super();
    }

    showAskDialog(options : IAskDialogOptions) {
        this._isDialogVisible = true;
        this._body = options.body;
        this._subBody = options.subBody;
        this._ok = options.ok;
        this._cancel = options.cancel;
        this.update();
        return new Promise<boolean>(resolve => {
            this._resolve = resolve;
        });
    }

    _hideDialog() {
        this._isDialogVisible = false;
        this._body = "";
        this._subBody = "";
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
                                this._subBody != "" &&
                                <div className='nbwhisper-dialog-subbody'>
                                    { this._subBody }
                                </div>
                            }
                            <div className='nbwhisper-dialog-buttons'>
                                {
                                    this._cancel != "" &&
                                    <div 
                                        className='nbwhisper-button nbwhisper-button-cancel'
                                        onClick={() => {
                                            this._hideDialog();
                                            this._onCancel();
                                        }}
                                    >
                                        <span>{ this._cancel }</span>
                                    </div>
                                }
                                {
                                    this._ok != "" &&
                                    <div 
                                        className='nbwhisper-button nbwhisper-button-normal'
                                        onClick={() => {
                                            this._hideDialog();
                                            this._onOk();
                                        }}
                                    >
                                        <span>{ this._ok }</span>
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