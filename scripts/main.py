import os
import json

import gradio as gr

from modules import shared, script_callbacks, scripts
import modules.sd_samplers
import modules.sd_models
import modules.sd_vae

from fastapi import FastAPI, Request

# /extensions/sd-webui-load-recent-state
DIR_PATH = scripts.basedir()
STATES_PATH = os.path.join(DIR_PATH, "states.json")
COMP_PATH = os.path.join(DIR_PATH, "components.json")

def read_json(p, defaultValue):
  if os.path.exists(p) == False:
    save_json(p, defaultValue)
    return defaultValue
  
  else:
    with open(p, "r") as file:
      return json.load(file)
  
def save_json(p, data):
  with open(p, "w") as file:
    file.write(json.dumps(data, indent=2))

def get_ckpt_name():
  sd_model_name = shared.sd_model.sd_checkpoint_info.name_for_extra
  sd_model_info = modules.sd_models.get_closet_checkpoint_match(sd_model_name)
  if sd_model_info is None:
    raise RuntimeError(f"Unknown checkpoint: {sd_model_name}")
  
  return sd_model_info.name

def get_vae_name():
  return modules.sd_vae.get_loaded_vae_name() or "None"
      
def on_app_started(_: gr.Blocks, app: FastAPI):
  @app.get("/shinich39/lrs/load")
  async def init():
    return {
      "componentIds": read_json(COMP_PATH, []),
      "states": read_json(STATES_PATH, {}),
    }
  
  @app.post("/shinich39/lrs/save")
  async def _update_state(req: Request):
    data = await req.json()
    save_json(STATES_PATH, data)

class Script(scripts.Script):
  def __init__(self):
    super().__init__()

  def title(self):
    return "LoadRecentState"
  
  def show(self, is_img2img):
    # return scripts.AlwaysVisible
    return False 
  
  def ui(self, is_img2img):
    """this function should create gradio UI elements. See https://gradio.app/docs/#components
    The return value should be an array of all components that are used in processing.
    Values of those returned components will be passed to run() and process() functions.
    """
    pass

script_callbacks.on_app_started(on_app_started)