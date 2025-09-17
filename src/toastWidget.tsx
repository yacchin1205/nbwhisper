import * as React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import toast, { Toaster, ToastOptions } from 'react-hot-toast';

export class ToastWidget extends ReactWidget {
  static baseOptions: ToastOptions = {
    position: 'top-center',
    duration: 4000,
    style: { zIndex: 99999 }
  };

  constructor() {
    super();
  }

  public error(text: string, options: object = {}) {
    toast.error(text, Object.assign(ToastWidget.baseOptions, options));
  }

  public info(text: string, options: object = {}) {
    toast(text, Object.assign(ToastWidget.baseOptions, options));
  }

  render(): JSX.Element {
    return (
      <div>
        <Toaster
          containerStyle={{
            zIndex: 99999 // For the container
          }}
        />
      </div>
    );
  }
}
