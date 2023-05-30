#!/usr/bin/env python

from setuptools import setup, find_packages
import os
import shutil

HERE = os.path.abspath(os.path.dirname(__file__))
VERSION_NS = {}
with open(os.path.join(HERE, 'nbwhisper', '_version.py')) as f:
    exec(f.read(), {}, VERSION_NS)

setup_args = dict(name='nbwhisper',
      version=VERSION_NS['__version__'],
      description='NBWhisper Jupyter Extension',
      author='NII',
      packages=find_packages(),
      include_package_data=True,
      zip_safe=False,
      platforms=['Jupyter Notebook 6.x'],
      install_requires=[
          'tornado',
          'traitlets',
      ],
      extras_require={
          'test': [
              'pytest',
          ],
      },
     )

if __name__ == '__main__':
    setup(**setup_args)