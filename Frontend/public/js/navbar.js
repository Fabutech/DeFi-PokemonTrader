const body = document.querySelector('body')
const sidebar = body.querySelector('nav')
const toggle = body.querySelector(".toggle")
const modeSwitch = body.querySelector(".toggle-switch") //toggle switch for light/dark mode
const modeText = body.querySelector(".mode-text")       

//NAVBAR OUT/IN TOGGLE
toggle.addEventListener("click" , () =>{ //if the toggle button is pressed, the close class is appended so the navbar closes
    sidebar.classList.toggle("close");
})


//LIGHT/DARK MODE
document.addEventListener("DOMContentLoaded", function() { //implements the current theme instantly on page load, so its the same if you load a new page
    const onpageLoad = localStorage.getItem("theme") || "light"; //localStorage to save the theme: light or dark, locally in the users browser    
    body.classList.add(onpageLoad);      //adds the class which the local storage saves to the body, dark for dark or "" if its light

    if(onpageLoad === "dark"){
        modeText.innerText = "Light mode"; //changes text to the corresponding mode
    }
    else{
        modeText.innerText = "Dark mode"; //changes text to the corresponding mode
    }
  });

//when pressing the modeSwitch button, swaps theme
modeSwitch.addEventListener("click" , () =>{
body.classList.toggle("dark");

if(body.classList.contains("dark")){
    modeText.innerText = "Light mode";
    localStorage.setItem("theme", "dark"); //saves the current theme in localStorage
    }
    else{
    modeText.innerText = "Dark mode";
    localStorage.setItem("theme", "");  //saves the current theme in localStorage
    }
}); 