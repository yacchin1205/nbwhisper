FROM niicloudoperation/notebook:latest

USER root

COPY . /tmp/nbwebrtc
RUN pip install /tmp/nbwebrtc && \
    jupyter nbclassic-extension install --py nbwebrtc && \
    jupyter nbclassic-serverextension enable --py nbwebrtc && \
    jupyter nbclassic-extension enable --py nbwebrtc

USER $NB_UID
