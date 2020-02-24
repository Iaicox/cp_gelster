 <!DOCTYPE html>
<html lang="ru">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php
    if ($_POST['addManagerName']) {
        echo "<title>Добавление нового менеджера</title>";
    } elseif ($_POST['content']) {
        echo "<title>Удаление менеджера</title>";
    } else {
        echo "<title>Редактирование списка менеджеров</title>";
    }
    ?>
    <link rel="stylesheet" href="../style/style.css">
</head>

<body style="padding: 15px;">
    <?php
    if ($_POST['addManagerName']) {
        $addManagerName = $_POST['addManagerName'];
        if ($_FILES['managerImg']['error'] > 0) {
            echo 'Проблема: ';
            switch ($_FILES['managerImg']['error']) {
                case 1: echo 'размер файла больше upload_max_filesize'; break;
                case 2: echo 'размер файла больше max_file_size'; break;
                case 3: echo 'загружена только часть файла'; break;
                case 4: echo 'файл не загружен'; break;
            }
            exit;
        }

        if ($_FILES['managerImg']['type'] != 'image/jpeg') {
            echo 'Проблема: файл не является картинкой!';
            exit;
        }
        
        $uploadfile = basename($_FILES['managerImg']['name']);
        
        if (move_uploaded_file($_FILES['managerImg']['tmp_name'], $uploadfile)) {
            echo "Картинка была успешно загружена.\n";
            echo "<br>".$addManagerName." добавлен в список менеджеров.\n";
            echo "<br><script>window.opener.location.reload();</script>\n";
            echo "<br><script>setTimeout(function() {window.close();}, 1500); </script>";
        } else {
            echo "Возможная атака с помощью файловой загрузки!\n";
            echo "<br><script>setTimeout(function() {window.close();}, 1500); </script>";
        }
        
        $new_manager = '    <option value="'.$uploadfile.'">'.$addManagerName.'</option>';
        $upfile = './managers.htm';
        $fp = fopen($upfile, 'r');
        $content = fread($fp, filesize ($upfile));
        fclose($fp);
        $edit_content = explode("\r\n", $content);
        $last_elem = $edit_content[count($edit_content)-1];
        $edit_content[count($edit_content)-1] = $new_manager;
        $edit_content[count($edit_content)] = $last_elem;
        $content = implode("\r\n", $edit_content);
        $fp = fopen($upfile, 'w');
        fwrite($fp, $content);
        fclose($fp);
    } elseif ($_POST['content']) {
        $content = $_POST['content'];
        $delManagName = $_POST['delManagName'];
        $delManagNameSrc = $_POST['delManagNameSrc'];
        unlink($delManagNameSrc);
        $upfile = './managers.htm';
        $fp = fopen($upfile, 'w');
        fwrite($fp, $content);
        fclose($fp);
        echo "$delManagName успешно удален из списка менеджеров";
        echo "<br><script>window.opener.location.reload();</script>\n";
        echo "<br><script>setTimeout(function() {window.close();}, 1500); </script>";
    } else {
        $upfile = './managers.htm';
        $fp = fopen($upfile, 'r');
        $content = fread($fp, filesize ($upfile));
        fclose($fp);
        echo    '<button id="addManagBtn" onclick="AddMngShow();" style="padding:10px; margin-bottom: 20px; cursor:pointer; border-radius:15px; border:0;">Добавить менеджера</button>';
        echo    '<button id="delManagBtn" onclick="DelMngShow();" style="padding:10px; margin-left:20px; cursor:pointer; border-radius:15px; border:0;">Удалить менеджера</button>';
        echo    '<form id="addManag" hidden enctype="multipart/form-data" action="add_manager.php" method="POST" style="background:#fff;">
                    <input type="hidden" name="MAX_FILE_SIZE" value="10000000">
                    Загрузите картинку с данными нового менеджера (Футер):<br>
                    <input name="managerImg" type="file"><br><br>
                    <label>
                        Введите имя и фамилию менеджера:<br>
                        <input name="addManagerName" type="text" placeholder="Введите имя и фамилию менеджера"><br><br>
                    </label>
                    <input type="submit" value="Добавить">
                </form>';
        echo    '<form id="delManag" hidden enctype="multipart/form-data" onsubmit="DelMng(select);" action="add_manager.php" method="POST" style="background:#fff;">
                    '.$content.'
                    <textarea name="content" cols="70" rows="15" hidden></textarea>
                    <input name="delManagName" type="text" hidden>
                    <input name="delManagNameSrc" type="text" hidden>
                    <input type="submit" value="Удалить" style="cursor:pointer; padding:5px;">
                </form>';
    }
    ?>
    <script>
        if (document.getElementById("addManagBtn")) {
            function AddMngShow() {
                document.getElementById("addManag").hidden = false;
                document.getElementById("delManag").hidden = true;
            }
            function DelMngShow() {
                document.getElementById("addManag").hidden = true;
                document.getElementById("delManag").hidden = false;
            }
            

            var select = document.getElementsByName('chooseManager')[0];
            select.onchange = function() {return false;};
        }
        function DelMng(elem) {
            var del = elem.value,
                content;

            for (var i=0; i<select.children.length; i++) {
                if (select.children[i].value == del) {
                    document.getElementsByName('delManagName')[0].value = select.children[i].innerText;
                    document.getElementsByName('delManagNameSrc')[0].value = select.children[i].value;
                    select.children[i].remove();
                }
            }

            content = select.outerHTML;
            content = content.replace(/    (?:\\[rn]|[\r\n])/g, "");
            document.getElementsByName('content')[0].value = content;
        }
    </script>
</body>

</html>