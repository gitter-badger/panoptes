#!/bin/bash
#Find out where this script is
SCRIPT_PATH="${BASH_SOURCE[0]}";
if ([ -h "${SCRIPT_PATH}" ]) then
  while([ -h "${SCRIPT_PATH}" ]) do SCRIPT_PATH=`readlink "${SCRIPT_PATH}"`; done
fi
pushd . > /dev/null
cd `dirname ${SCRIPT_PATH}`
#We are now at the dir of the script go one up to project
cd ..
PROJECT_ROOT=`pwd`;

source build/panoptes_virtualenv/bin/activate
PYTHONPATH=${PROJECT_ROOT}/build/DQXServer:${PROJECT_ROOT}/servermodule/panoptesserver/importer
export PYTHONPATH

#pip install nose
#nosetests
python ${PROJECT_ROOT}/servermodule/panoptesserver/importer/ImportSettings.py
