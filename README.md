<p align="center">
  <img width="100%" height="100%" src="images/banner.png">
</p>

Using [**EmulatorJS**](https://github.com/EmulatorJS/) to preserve an original game created with RPG Maker (PSX).

> [!NOTE]  
> **No ROMs or bios files are included in this repo.**

## Table of Contents
- [Introduction](#introduction)
- [Usage](#usage)
- [Features](#features)
- [Booklet](#booklet)
- [License](#license)
- [Contact](#contact)
- [Acknowledgements](#acknowledgements)

![Tim meets Jim](images/jim_screen.png)
![poisoned man gives advice](images/sick_screen.png)
![Tim is confused](images/huh_screen.png)

---

## Introduction
**NSK Warrior** is a comical, survival-horror game about an aspiring janitor working at a grimy factory.  

Since it was originally developed using RPG Maker for the PlayStation (PSX), the game was incredibly difficult to share. 

Thanks to [**EmulatorJS**](https://github.com/EmulatorJS/), this project brings the experience to the web, making it easily accessible.

## Usage
To play the game, simply open your web browser and navigate to [nsk-warrior.netlify.app](https://nsk-warrior.netlify.app). Install the PWA to your home screen for a more integrated experience.

The game is also available at [itch.io](https://imaginary-monkey.itch.io/nsk-warrior).

## Features
- **Playable in Browser:**  Enjoy the game directly in your web browser.
  
- **PWA Support:**  Install as a Progressive Web App for a native app-like experience.

- **Version Manager:**  Select which game version to play and choose a save slot. Import, Share or Delete saves. Uses emulator save states.
  
- **Original Game Booklet:**  While playing, flip through maps and game details of the original booklet that accompanied the game.

![demo of booklet](images/booklet.avif)

## Booklet
To add a game booklet to your project:
- Copy the booklet folder to your project.
- Replace pages with your images.
- Add links for the stylesheet and js files in your html.
  ```html
  <head>
  ...
    <link rel="stylesheet" href="booklet/booklet.css">
  ...
  </head>
  ...
  <body>
  ...
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
    <script src="/booklet/turn.min.js"></script>
    <script src="/booklet/panzoom.min.js"></script>
    <script src="/booklet/booklet.js"></script>
  </body>
  ```
- Insert something like this in your html:
  ```html
  <div class="container" id="container"> <!-- Add container styles to your css -->
    <input type="checkbox" id="toggleButton" class="toggle-button">
    <label for="toggleButton">
      <img src="images/manual_icon.webp" width="40" height="40" alt="Game Booklet">
    </label>
    <div id="book">
      <!-- Pages added here from script -->
    </div>
    <div id="game"></div> <!-- Or whatever the div that displays your game is called -->
  </div>
  <audio id="flip" src="sound/page_turn.mp3"></audio>
  <audio id="slide1" src="sound/slide_in.mp3"></audio>
  <audio id="slide2" src="sound/slide_out.mp3"></audio>
  <div id="blurBackground" class="blurred-background" style="display: none;"></div>
  ```

## License 

This project is licensed under the
[GNU General Public License v3.0 license](LICENSE), 
with the exception of Turn.js, which is released under a [non-commercial BSD license](http://turnjs.com/license.txt).

## Contact
James Coburn - jamesrobertcoburn@gmail.com

## Acknowledgements
- [**EmulatorJS**](https://github.com/EmulatorJS/)
- **RPG Maker**
- [**Turn.js**](https://github.com/bahadirdogru/Turn.js-5)
- [**Panzoom**](https://github.com/timmywil/panzoom)

---
![montage: party walks through various locations](images/montage.avif)

![booklet page 1](booklet/pages/1.webp)
