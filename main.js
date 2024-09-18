//1.Picutre class component
class Picture {           //1.Picture class-Represents image being drawn
    constructor(width, height, pixels) {
      this.width = width;
      this.height = height;
      this.pixels = pixels;
    }
  
    //2. Creates an empty picture of a given width and height, with all pixels set to a single color
    static empty(width, height, color) {
      let pixels = new Array(width * height).fill(color);    // Create an array with the size of width * height and fill it with the specified color
      return new Picture(width, height, pixels);             // Return a new Picture object with the specified width, height, and pixels
    }
  
    // 3.Returns the color of the pixel at coordinates (x, y)
    pixel(x, y) {
      return this.pixels[x + y * this.width];   // Calculate the index of the pixel in the one-dimensional array
    }
  
    // 4.Creates a new picture with the specified pixels modified
    draw(pixels) {
      // Create a copy of the current pixels array
      let copy = this.pixels.slice();
      // Update the copy with the new pixels
      for (let {x, y, color} of pixels) {
        // Calculate the index in the array and set the new color
        copy[x + y * this.width] = color;
      }
      // Return a new Picture object with the modified pixels
      return new Picture(this.width, this.height, copy);
    }
  }


//2..Updatestate function is responsibe for updating state,it takes current state and action object,merges them and returns a new state
function updateState(state, action) {
    // Create a new state object by merging the current state and the action
    return {...state, ...action};
}
  

//3.elt function to simpltify the creation of DOM elements
function elt(type, props, ...children) {
    let dom = document.createElement(type);         //Create a new DOM element of the specified type
    if (props) Object.assign(dom, props);          //If properties are provided, apply them to the element
    
    //Add each child element or text node to the DOM element
    for (let child of children) {
      if (typeof child != "string") {
        dom.appendChild(child);                   //Append child if it's a DOM node
      } else {
        dom.appendChild(document.createTextNode(child));         //Convert string to a text node and append it
      }
    }
    return dom;         //Return the fully created DOM element
  }
  


//4.PictureCanvas Class Component
const scale = 10; // Scale factor for each pixel

class PictureCanvas {  
  constructor(picture, pointerDown) {   //The Picture object to display and Callback function for pointer down events
    this.dom = elt("canvas", {
      onmousedown: event => this.mouse(event, pointerDown),           // Create the canvas element and attach event handlers for mouse and touch events
      ontouchstart: event => this.touch(event, pointerDown)
    });
    this.syncState(picture);
  }

  syncState(picture) {      // syncState()=To update canvas whenever a picture is set
    if (this.picture === picture) {
        return;                                  // Check if the picture is the same as the current one to avoid unnecessary updates
    }       
    this.picture = picture;
    drawPicture(this.picture, this.dom, scale);    // Draw the new picture on the canvas   
  }

//4.1.Handles mouse events on the canvas.
  mouse(downEvent, onDown) {                 // parameters: downEvent -The mousedown event object & onDown - Callback function for when the mouse is pressed.
    if (downEvent.button !== 0) return;           // Ensure that only the left mouse button is handled

    let pos = pointerPosition(downEvent, this.dom);      // Calculate the position of the pointer in picture coordinates
    let onMove = onDown(pos);                           // Call the callback to handle mouse down action

    if (!onMove) return; // If no callback is returned, exit
    let move = moveEvent => {                              // Define a function to handle mouse movements
      if (moveEvent.buttons === 0) {
        this.dom.removeEventListener("mousemove", move);      // Stop tracking movements when the mouse button is released
      } else {
        let newPos = pointerPosition(moveEvent, this.dom);          // Update position and call the callback if the position has changed
        if (newPos.x === pos.x && newPos.y === pos.y) return;
        pos = newPos;
        onMove(newPos);
      }
    };
    this.dom.addEventListener("mousemove", move);
  }

  
//4.2.Handles touch events on the canvas.
   touch(startEvent, onDown) {
    let pos = pointerPosition(startEvent.touches[0], this.dom); // Calculate the position of the touch in picture coordinates    
    let onMove = onDown(pos); // Call the callback to handle touch start action
    startEvent.preventDefault(); // Prevent default touch actions such as panning

    if (!onMove) return; // If no callback is returned, exit
    let move = moveEvent => {                 // Define a function to handle touch movements
      let newPos = pointerPosition(moveEvent.touches[0], this.dom);
      if (newPos.x === pos.x && newPos.y === pos.y) return;
      pos = newPos;
      onMove(newPos);
    };
    let end = () => {                                    // Define a function to stop tracking touch movements
      this.dom.removeEventListener("touchmove", move);       
      this.dom.removeEventListener("touchend", end);
    };
    this.dom.addEventListener("touchmove", move);            // Add event listeners for touch movements and touch end
    this.dom.addEventListener("touchend", end);
  }
}

//4.3.Draws the picture on the canvas.
function drawPicture(picture, canvas, scale) {           // Set the canvas size based on picture dimensions and scale
  canvas.width = picture.width * scale;
  canvas.height = picture.height * scale;
  let cx = canvas.getContext("2d");                      // Draw each pixel as a colored square on the canvas
  for (let y = 0; y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      cx.fillStyle = picture.pixel(x, y);
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

//4.4Converts pointer (mouse or touch) coordinates to canvas coordinates.
function pointerPosition(pos, domNode) {
  let rect = domNode.getBoundingClientRect();
  return {
    x: Math.floor((pos.clientX - rect.left) / scale),
    y: Math.floor((pos.clientY - rect.top) / scale)
  };
}


//5.pixelEditor Component-THis is the main component that acts as shell around pictureCanvas and controls
class PixelEditor {
    constructor(state, config) {
      let {tools, controls, dispatch} = config; // Destructure the configuration object
      this.state = state; // Store the initial application state
  
      // Create a PictureCanvas instance
      this.canvas = new PictureCanvas(state.picture, pos => {
        // Get the currently selected tool from the tools object
        let tool = tools[this.state.tool];
        // Call the tool function with the position, state, and dispatch
        let onMove = tool(pos, this.state, dispatch);
        // If the tool returns a move handler, adapt it to receive the state
        if (onMove) return pos => onMove(pos, this.state);
      });
      // Create an array of control instances using the constructors provided in config
      this.controls = controls.map(
        Control => new Control(state, config)
      );
      // Create the main DOM structure: a div containing the canvas and controls
      this.dom = elt("div", {}, this.canvas.dom, elt("br"),
        ...this.controls.reduce(
          (a, c) => a.concat(" ", c.dom), [] // Add spaces between controls for better appearance
        )
      );
    }
    // Method to synchronize the component state with the application state
    syncState(state) {
      this.state = state; // Update the internal state
      this.canvas.syncState(state.picture); // Update the canvas
      // Update each control to reflect the new state
      for (let ctrl of this.controls) ctrl.syncState(state);
    }
  }


//6.ToolSelect Class;- This control allows user to elect different tools to interact with picture
class ToolSelect {
    constructor(state, {tools, dispatch}) {
      // Create a <select> element with an option for each tool
      this.select = elt("select", {
        onchange: () => dispatch({tool: this.select.value}) // Dispatch an action when the selection changes
      }, ...Object.keys(tools).map(name => elt("option", {
        selected: name == state.tool // Mark the currently selected tool as selected
      }, name)));
  
      // Create the label that contains the select element
      this.dom = elt("label", null, "🖌 Tool: ", this.select);
    }
    // Synchronize the select element's value with the application state
    syncState(state) {
      this.select.value = state.tool;
    }
  }
  

//7.ColorSelect Class:- This controls allow user to select a color using a color picker input
class ColorSelect {
    constructor(state, {dispatch}) {
      // Create a color input element
      this.input = elt("input", {
        type: "color", // Set the input type to 'color'
        value: state.color, // Set the initial color value
        onchange: () => dispatch({color: this.input.value}) // Dispatch an action when the color changes
      });
  
    // Create the label that contains the color input
      this.dom = elt("label", null, "🎨 Color: ", this.input);
    }
    // Synchronize the input element's value with the application state
    syncState(state) {
      this.input.value = state.color;
    }
  }


//8.Draw Tool:- Changes the color of any pixel you click or tap ot the current selected color
function draw(pos, state, dispatch) {
    function drawPixel({x, y}, state) {
      // Create an object representing the pixel to be drawn with the current color
      let drawn = {x, y, color: state.color};
      // Dispatch an action to update the picture with the drawn pixel
      dispatch({picture: state.picture.draw([drawn])});
    }
    
    // Draw the initial pixel
    drawPixel(pos, state);
    
    // Return the drawPixel function to handle further moves (dragging)
    return drawPixel;
  }
  
//9.Rectangle tool:-The rectangle tool allows the user to draw a rectangle by clicking and dragging on the canvas.
function rectangle(start, state, dispatch) {
    function drawRectangle(pos) {
      // Determine the starting and ending points of the rectangle
      let xStart = Math.min(start.x, pos.x);
      let yStart = Math.min(start.y, pos.y);
      let xEnd = Math.max(start.x, pos.x);
      let yEnd = Math.max(start.y, pos.y);
      let drawn = [];
      
      // Loop through the rectangle area and collect pixels to be drawn
      for (let y = yStart; y <= yEnd; y++) {
        for (let x = xStart; x <= xEnd; x++) {
          drawn.push({x, y, color: state.color});
        }
      }
      // Dispatch an action to update the picture with the drawn rectangle
      dispatch({picture: state.picture.draw(drawn)});
    }
    // Draw the initial rectangle
    drawRectangle(start);
    // Return drawRectangle to handle resizing as the user drags
    return drawRectangle;
  }
  

//10.Flood fill tool
const around = [{dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1}];

function fill({x, y}, state, dispatch) {
  // Get the color of the pixel where the user clicked
  let targetColor = state.picture.pixel(x, y);
  // Start filling with the current color
  let drawn = [{x, y, color: state.color}];
  let visited = new Set();
  
  // Explore all connected pixels of the same color
  for (let done = 0; done < drawn.length; done++) {
    for (let {dx, dy} of around) {
      let x = drawn[done].x + dx, y = drawn[done].y + dy;
      // Check if the pixel is within bounds, hasn't been visited, and is the target color
      if (x >= 0 && x < state.picture.width &&
          y >= 0 && y < state.picture.height &&
          !visited.has(x + "," + y) &&
          state.picture.pixel(x, y) == targetColor) {
        // Add the pixel to the list to be drawn
        drawn.push({x, y, color: state.color});
        visited.add(x + "," + y);
      }
    }
  }
  // Dispatch an action to update the picture with the filled area
  dispatch({picture: state.picture.draw(drawn)});
}




//11.Save Functionality
// SaveButton class: Provides a button to save the current picture as an image file
class SaveButton {
    constructor(state) {
      // Store the current picture state for saving
      this.picture = state.picture;
      // Create a button element with an "onclick" handler to trigger the save action
      this.dom = elt("button", {
        onclick: () => this.save()
      }, "💾 Save"); // Button text
    }
// save() Method to save the picture as an image file
    save() {
      // Create a new canvas element
      let canvas = elt("canvas");
      // Draw the current picture onto the canvas at a scale of 1:1
      drawPicture(this.picture, canvas, 1);
      // Convert the canvas content into a data URL (Base64 encoded PNG image)
      let link = elt("a", {
        href: canvas.toDataURL(),
        download: "pixelart.png" // Filename for the download
      });
      // Temporarily add the link to the document to simulate a click for download
      document.body.appendChild(link);
      link.click(); // Simulate a click on the link to prompt download
      link.remove(); // Remove the link element after downloading
    }
  
// Update the current picture when the state changes
    syncState(state) {
      this.picture = state.picture;
    }
  }
  
  
//12.Load Button  functionality
// LoadButton class: Provides a button to load an existing image file into the application
  class LoadButton {
    constructor(_, { dispatch }) {
      // Create a button element with an "onclick" handler to start the loading process
      this.dom = elt("button", {
        onclick: () => startLoad(dispatch)
      }, "📁 Load"); // Button text
    }
  
    // This control doesn't need to synchronize with the state
    syncState() {}
  }
  

//13.startLoad:-Function to start the file loading process
  function startLoad(dispatch) {
    // Create a hidden file input element to select a file
    let input = elt("input", {
      type: "file",
      onchange: () => finishLoad(input.files[0], dispatch) // Handler when a file is selected
    });
    // Temporarily add the input to the document to simulate a click for file selection
    document.body.appendChild(input);
    input.click(); // Simulate a click on the input to open file selection dialog
    input.remove(); // Remove the input element after file selection
  }
  

//14.finishLoad:- Function to process the selected file and load it into the application
  function finishLoad(file, dispatch) {
    // If no file was selected, do nothing
    if (file == null) return;
  
    // Create a FileReader to read the file's content
    let reader = new FileReader();
    reader.addEventListener("load", () => {
      // Create an image element and set its source to the file content (as data URL)
      let image = elt("img", {
        onload: () => dispatch({
          picture: pictureFromImage(image) // Convert the image to a Picture object
        }),
        src: reader.result // File content as data URL
      });
    });
    reader.readAsDataURL(file); // Read the file as a data URL
  }


//15.pictureFromImage:-Function to convert an HTML image element to a Picture object
  function pictureFromImage(image) {
    // Limit the image size to 100x100 pixels to avoid performance issues
    let width = Math.min(100, image.width);
    let height = Math.min(100, image.height);
    // Create a canvas to draw the image onto
    let canvas = elt("canvas", { width, height });
    let cx = canvas.getContext("2d");
    // Draw the image on the canvas
    cx.drawImage(image, 0, 0);
    let pixels = [];
    // Get the image data from the canvas
    let { data } = cx.getImageData(0, 0, width, height);
  
    // Helper function to convert a number to a hexadecimal string with two digits
    function hex(n) {
      return n.toString(16).padStart(2, "0");
    }
  
    // Loop through the image data and convert each pixel to a hex color string
    for (let i = 0; i < data.length; i += 4) {
      let [r, g, b] = data.slice(i, i + 3);
      // Push the hex color value to the pixels array
      pixels.push("#" + hex(r) + hex(g) + hex(b));
    }
  
    // Return a new Picture object created from the pixel data
    return new Picture(width, height, pixels);
  }
  