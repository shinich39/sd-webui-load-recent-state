const BUTTON_IDS = [
  "txt2img_generate",
  "img2img_generate",
  "extras_generate",
];

const TRIGGER_IDS = [
  "setting_sd_model_checkpoint",
];

const COMPONENTS = [
  // Load from server
];

// console.log(gradioApp());
// console.log(gradio_config);

async function loadState() {
  return await receive("/shinich39/lrs/load");
}

async function saveState(data) {
  return await send("/shinich39/lrs/save", data);
}

let currentStates;

;(async function() {
  let isRendered = await chkButtons();
  while(!isRendered) {
    isRendered = await chkButtons();
  }

  const {
    componentIds,
    state,
  } = await loadState();
  
  for (const id of componentIds) {
    const elem = document.getElementById(id);
    const comp = gradio_config.components.find(e => e.props?.elem_id == id);

    let input, 
        isCheckbox = false;
    if (elem) {
      if (elem.type == "checkbox" || elem.type == "radio") {
        input = elem;
        isCheckbox = true;
      } else if (elem.tagName.toLowerCase() == "input" || elem.tagName.toLowerCase() == "textarea") {
        input = elem;
      } else {
        input = elem.querySelector("input") || elem.querySelector("textarea");
        if (input) {
          isCheckbox = input.type == "checkbox" || input.type == "radio";
        }
      }
    }
    
    COMPONENTS.push({
      isCheckbox,
      id,
      elem,
      input,
      comp,
    });
  }
  // console.log("Components loaded", COMPONENTS);

  currentStates = state;
  // console.log("Current state loaded", currentStates);

  // await wait(1024);

  // Set generate button events
  BUTTON_IDS.forEach((id) => {
    const elem = document.getElementById(id);
    elem?.addEventListener("click", async function(e) {
      const data = getInputValues();
      // console.log("State:", data);
      currentStates[getCkptName()] = data;
      await saveState(currentStates);
      // console.log("State saved");
    });
  });

  // Set checkpoint input events
  TRIGGER_IDS.forEach((id) => {
    const elem = document.getElementById(id);
    const input = elem?.querySelector("input") || elem?.querySelector("textarea");
    if (input) {
      observeElement(input, "value", function(oldValue, newValue) {
        ;(async () => {
          console.log("Checkpoint changed:", oldValue, "=>", newValue);
          const ckpt = normalizeCkptName(newValue);
          const data = currentStates[ckpt];
          if (data) {
            setInpuValues(data);
            // console.log("Input values loaded");
          } else {
            // console.error("State not found");
          }
        })();
      });
    }
  });

  const ckpt = getCkptName();
  if (ckpt) {
    const data = currentStates[ckpt];
    if (data) {
      setInpuValues(data);
      // console.log("Input values loaded");
    } else {
      // console.error("State not found");
    }
  }
})();

function getCkptName() {
  for (const id of TRIGGER_IDS) {
    const elem = document.getElementById(id);
    const input = elem?.querySelector("input") || elem?.querySelector("textarea");
    if (input) {
      return normalizeCkptName(input.value);
    }
  }
}

function normalizeCkptName(v) {
  return v.replace(/\s\[[a-zA-Z0-9]+\]$/, "");
}

// From https://stackoverflow.com/a/61975440, how to detect JS value changes
function observeElement(element, property, callback, delay = 0) {
  let elementPrototype = Object.getPrototypeOf(element);
  if (elementPrototype.hasOwnProperty(property)) {
    let descriptor = Object.getOwnPropertyDescriptor(elementPrototype, property);
    Object.defineProperty(element, property, {
      get: function() {
        return descriptor.get.apply(this, arguments);
      },
      set: function () {
        let oldValue = this[property];
        descriptor.set.apply(this, arguments);
        let newValue = this[property];
        if (typeof callback == "function") {
          setTimeout(callback.bind(this, oldValue, newValue), delay);
        }
        return newValue;
      }
    });
  }
}

function wait(d) {
  return new Promise(function(resolve) {
    setTimeout(resolve, d);
  });
}

function updateInput(target) {
  try {
    // Simulate an `input` DOM event for Gradio Textbox component. Needed after you edit its contents in javascript, otherwise your edits
    // will only visible on web page and not sent to python.
    // let e = new Event("input", {bubbles: true});
    // Object.defineProperty(e, "target", { value: target });
    // target.dispatchEvent(e);

    const e = new Event("change", {bubbles: true});
    Object.defineProperty(e, "target", { value: target });
    target.dispatchEvent(e);
  } catch(err) {
    console.error(err);
  }
}

async function receive(url, json = true, cache = false) {
  if (!cache) {
    const appendChar = url.includes("?") ? "&" : "?";
    url += `${appendChar}${new Date().getTime()}`
  }

  let response = await fetch(url);

  if (response.status != 200) {
      console.error(`Error fetching API endpoint "${url}": ` + response.status, response.statusText);
      return null;
  }

  if (json) {
    return await response.json();
  } else {
    return await response.text();
  }
}

async function send(url, body = null) {
  let response = await fetch(url, {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: body ? JSON.stringify(body) : null,
  });

  if (response.status != 200) {
      console.error(`Error posting to API endpoint "${url}": ` + response.status, response.statusText);
      return null;
  }

  return await response.json();
}

function chkButtons() {
  return new Promise(function(resolve, reject) {
    const buttons = [
      ...BUTTON_IDS,
      ...TRIGGER_IDS,
    ];
    
    setTimeout(() => {
      let count = 0;

      buttons.forEach((id) => {
        const elem = document.getElementById(id);
        if (elem) {
          count++;
        }
      });

      resolve(count == buttons.length);
    }, 256);
  });
}

function getInputValues() {
  const result = COMPONENTS.map(({
    isCheckbox,
    id,
    elem,
    input,
    comp,
  }) => {

    let value = input ? input.value : null, 
        checked = isCheckbox ? input.checked : false,
        props = comp?.props;

    return {
      id,
      isCheckbox,
      value,
      checked,
      props,
    }
  }).filter(Boolean);

  return result;
}

function setInpuValues(data) {
  for (const {
    id,
    isCheckbox,
    value,
    checked,
    props,
  } of data) {
    const obj = COMPONENTS.find(e => e.id == id);
    if (!obj) {
      continue;
    }

    const { elem, comp, input } = obj;
    
    if (input) {
      if (isCheckbox) {
        input.checked = checked;
      } else {
        input.value = value;
      }
    }

    if (comp) {
      comp.props = props;
      comp.instance.$set({ value: comp.props.value });
    }

    if (elem) {
      updateInput(elem);
    }
  }
}