@echo off
title SPYDEE Database Switcher
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0switch-db.ps1" %*
