@echo off
node "%~dp0node_modules\typescript\bin\tsc" -b
if errorlevel 1 exit /b %errorlevel%
node "%~dp0node_modules\vite\bin\vite.js" build
