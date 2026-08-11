package com.samtius.arenaparser;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ArenaParserApplication {

    public static void main(String[] args) {
        SpringApplication.run(ArenaParserApplication.class, args);
    }
}
