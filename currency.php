<?php
header('Content-Type: text/html; charset=utf-8');
$xml = file_get_contents("https://www.cbr.ru/scripts/XML_daily.asp");
print $xml;
?>