@echo off
rem Abre la animacion de Plot Center a pantalla completa y en bucle (modo quiosco).
rem Para salir: Alt+F4. Para que arranque con Windows, poner un acceso directo a este archivo
rem en la carpeta de inicio (Win+R, escribir shell:startup).
set "URL=file:///%~dp0index.html?kiosk"
set "URL=%URL:\=/%"

set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%NAV%" set "NAV=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%NAV%" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%NAV%" set "NAV=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%NAV%" (
  echo No se encontro Chrome ni Edge en este equipo.
  pause
  exit /b 1
)

start "" "%NAV%" --kiosk --user-data-dir="%TEMP%\plot-mostrador" --no-first-run --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required "%URL%"
