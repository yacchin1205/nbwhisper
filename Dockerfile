FROM niicloudoperation/notebook:latest

USER root

COPY . /tmp/nbwebrtc
RUN pip install /tmp/nbwebrtc && \
    jupyter nbclassic-extension install --py nbwebrtc --sys-prefix && \
    jupyter nbclassic-serverextension enable --py nbwebrtc --sys-prefix && \
    jupyter nbclassic-extension enable --py nbwebrtc --sys-prefix

# Configuration for Server Proxy
RUN cat /tmp/nbwebrtc/example/jupyter_notebook_config.py >> $CONDA_DIR/etc/jupyter/jupyter_notebook_config.py

USER $NB_UID
