package com.samtius.arenaparser.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;

import static org.springframework.http.HttpStatus.ACCEPTED;
import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping("/api/application")
public class ApplicationController {

    @PostMapping("/shutdown")
    public ResponseEntity<Map<String, String>> shutdown(HttpServletRequest request) throws IOException {
        if (!request.getRemoteAddr().equals("127.0.0.1") && !request.getRemoteAddr().equals("0:0:0:0:0:0:0:1")) {
            return ResponseEntity.status(FORBIDDEN).body(Map.of("status", "forbidden"));
        }

        var projectRoot = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        var stopScript = projectRoot.resolve("scripts").resolve("stop-app.ps1");
        var escapedScript = stopScript.toString().replace("'", "''");
        var command = "Start-Sleep -Seconds 1; & '" + escapedScript + "'";

        new ProcessBuilder(
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-WindowStyle", "Hidden",
                "-Command", command
        ).directory(projectRoot.toFile()).start();

        return ResponseEntity.status(ACCEPTED).body(Map.of("status", "shutting-down"));
    }
}
