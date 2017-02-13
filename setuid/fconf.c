#include <stdlib.h>
#include <sys/types.h>
#include <unistd.h>

/*
 * 1. `gcc fconf.c -o fconf_root`
 * 2. make sure fconf_root it's owned by root
 * 3. `chmod u=rwx,go=xr,+s fconf_root`
 */

int
main (int argc, char *argv[])
{
	setuid (0);
	execv ("/usr/local/bin/fconf", argv);

	return 0;
}
