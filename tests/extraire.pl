local $/; my $t = <STDIN>; $t =~ s/\r//g;
print $1 if $t =~ /RAPPORT_DEBUT\n(.*?)\nRAPPORT_FIN/s;
