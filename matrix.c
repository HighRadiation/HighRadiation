#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <signal.h>
#include <string.h>

int *drops = NULL;
char **screen = NULL;
int width = 0, height = 0;
const char *binary42 = "101010"; // 42'nin binary temsili
int binaryLen = 6;

void cleanup(int sig) {
    printf("\033[?25h");
    if (screen) {
        for (int i = 0; i < height; i++) {
            free(screen[i]);
        }
        free(screen);
    }
    if (drops) free(drops);
    exit(0);
}

void update_terminal_size() {
    struct winsize w;
    ioctl(0, TIOCGWINSZ, &w);

    int new_width = w.ws_col;
    int new_height = w.ws_row;

    if (new_width != width || new_height != height) {
        if (screen) {
            for (int i = 0; i < height; i++) free(screen[i]);
            free(screen);
        }
        if (drops) free(drops);

        width = new_width;
        height = new_height;

        drops = (int*)malloc(width * sizeof(int));
        for (int i = 0; i < width; i++) {
            drops[i] = height + (rand() % (height * 2));
        }

        screen = (char**)malloc(height * sizeof(char*));
        for (int i = 0; i < height; i++) {
            screen[i] = (char*)malloc(width * sizeof(char));
            for (int j = 0; j < width; j++) {
                screen[i][j] = ' ';
            }
        }
    }
}

int main() {
    srand(time(NULL));
    signal(SIGINT, cleanup);

    printf("\033[2J");
    printf("\033[?25l");

    update_terminal_size();

    while (1) {
        update_terminal_size();

        for (int i = 0; i < height; i++)
            for (int j = 0; j < width; j++)
                screen[i][j] = ' ';

        for (int i = 0; i < width; i++) {
            drops[i]--;
            if (drops[i] < -10)
                drops[i] = height + (rand() % (height / 2));

            if (drops[i] < height) {
                // Ana karakter (en parlak)
                if (drops[i] >= 0) {
                    screen[drops[i]][i] = binary42[rand() % binaryLen];
                }

                // Arkasındaki soluk karakterler
                for (int j = 1; j < 20; j++) {
                    int y = drops[i] + j;
                    if (y >= 0 && y < height) {
                        screen[y][i] = binary42[rand() % binaryLen];
                    }
                }
            }
        }

        printf("\033[H");

        for (int i = 0; i < height; i++) {
            for (int j = 0; j < width; j++) {
                if (screen[i][j] != ' ') {
                    // Hangi drop'a ait olduğunu bul
                    int distance_from_head = -1;
                    for (int d = 0; d < width; d++) {
                        if (d == j && drops[d] < height) {
                            if (i == drops[d]) {
                                distance_from_head = 0; // Baş karakter
                                break;
                            } else if (i > drops[d] && i <= drops[d] + 19) {
                                distance_from_head = i - drops[d]; // Kuyruk karakteri
                                break;
                            }
                        }
                    }

                    if (distance_from_head == 0) {
                        // Baş karakter - en parlak yeşil
                        printf("\033[1;32m%c\033[0m", screen[i][j]);
                    } else if (distance_from_head > 0 && distance_from_head <= 3) {
                        // Yakın karakterler - parlak yeşil
                        printf("\033[1;32m%c\033[0m", screen[i][j]);
                    } else if (distance_from_head > 3 && distance_from_head <= 8) {
                        // Orta karakterler - normal yeşil
                        printf("\033[32m%c\033[0m", screen[i][j]);
                    } else {
                        // Uzak karakterler - soluk yeşil
                        printf("\033[2;32m%c\033[0m", screen[i][j]);
                    }
                } else {
                    printf(" ");
                }
            }
            if (i < height - 1)
                printf("\n");
        }

        fflush(stdout);
        usleep(80000);
    }

    cleanup(0);
    return 0;
}

