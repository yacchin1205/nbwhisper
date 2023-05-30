FROM niicloudoperation/notebook:latest

USER root

COPY . /tmp/nbwhisper
RUN pip install /tmp/nbwhisper && \
    jupyter nbclassic-extension install --py nbwhisper --sys-prefix && \
    jupyter nbclassic-serverextension enable --py nbwhisper --sys-prefix && \
    jupyter nbclassic-extension enable --py nbwhisper --sys-prefix

# Configuration for Server Proxy
RUN cat /tmp/nbwhisper/example/jupyter_notebook_config.py >> $CONDA_DIR/etc/jupyter/jupyter_notebook_config.py

USER $NB_UID
