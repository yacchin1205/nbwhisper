FROM jupyter/scipy-notebook:latest

USER root

### extensions for jupyter
COPY . /tmp/nbwhisper
RUN pip --no-cache-dir install /tmp/nbwhisper

RUN jupyter labextension enable nbwhisper

RUN fix-permissions /home/$NB_USER

USER $NB_USER