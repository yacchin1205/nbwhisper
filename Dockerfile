FROM jupyter/scipy-notebook:latest

USER root

# install aiohttp
RUN pip install aiohttp~=3.9.3

### extensions for jupyter
COPY . /tmp/nbwhisper
RUN pip --no-cache-dir install /tmp/nbwhisper

RUN jupyter labextension enable nbwhisper

RUN fix-permissions /home/$NB_USER

# Configuration
RUN cat /tmp/nbwhisper/example/jupyter_notebook_config.py >> $CONDA_DIR/etc/jupyter/jupyter_notebook_config.py

USER $NB_USER