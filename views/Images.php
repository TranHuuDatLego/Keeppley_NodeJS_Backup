<?php
// Lấy tên file này
$website = basename($_SERVER['SCRIPT_NAME']);
// echo $website;

include '../php/login.php';
// Chưa đăng nhập 
if (isset($_SESSION["userID"])) {
    $userID = $_SESSION["userID"];
    // print_r($userName);
    $sqlLogin = "SELECT * FROM `User` WHERE userID = '$userID' ";
    $queryLogin = mysqli_query($conn, $sqlLogin);
    // print_r($queryLogin);
    // Kiểm tra kết quả truy vấn

    // Duyệt qua từng hàng dữ liệu từ kết quả truy vấn
    $row = $queryLogin->fetch_assoc();
    // Thêm thông tin từng hàng vào mảng $userLogin
    $userLogin = array(
        "userID" => $row["userID"],
        "userName" => $row["userName"],
        "email" => $row["email"],
        "image" => $row["image"],
        "loginpassword" => $row["loginpassword"],
        "birthday" => $row["birthday"],
        "bio" => $row["bio"],
        "country" => $row["country"],
        "phone" => $row["phone"]
    );
} else {
    // Chưa đăng nhập 
    header('Location: ../php/form_login_en.php');
    exit();
}

?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <title>Account Settings</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <?php include '../php/head.php'; ?>


    <link href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.0/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Offline -->
    <link href="../style/bootstrap_4.5.0.css" rel="stylesheet">

    <!-- Thêm favicon vào đây -->
    <link rel="icon" href="../images/keeppley_logo.webp" type="image/x-icon">

    <style type="text/css">
        body {
            background: #f5f5f5;
            
        }

        .ui-w-80 {
            width: 80px !important;
            height: auto;
        }

        .btn-default {
            border-color: rgba(24, 28, 33, 0.1);
            background: rgba(0, 0, 0, 0);
            color: #4E5155;
        }

        label.btn {
            margin-bottom: 0;
        }

        .btn-outline-primary {
            border-color: #26B4FF;
            background: transparent;
            color: #26B4FF;
        }

        .btn {
            cursor: pointer;
        }

        .text-light {
            color: #babbbc !important;
        }

        .btn-facebook {
            border-color: rgba(0, 0, 0, 0);
            background: #3B5998;
            color: #fff;
        }

        .btn-instagram {
            border-color: rgba(0, 0, 0, 0);
            background: #000;
            color: #fff;
        }

        .card {
            background-clip: padding-box;
            box-shadow: 0 1px 4px rgba(24, 28, 33, 0.012);
        }

        .row-bordered {
            overflow: hidden;
        }

        .account-settings-fileinput {
            position: absolute;
            visibility: hidden;
            width: 1px;
            height: 1px;
            opacity: 0;
        }

        .account-settings-links .list-group-item.active {
            font-weight: bold !important;
        }

        html:not(.dark-style) .account-settings-links .list-group-item.active {
            background: transparent !important;
        }

        .account-settings-multiselect~.select2-container {
            width: 100% !important;
        }

        .light-style .account-settings-links .list-group-item {
            padding: 0.85rem 1.5rem;
            border-color: rgba(24, 28, 33, 0.03) !important;
        }

        .light-style .account-settings-links .list-group-item.active {
            color: #4e5155 !important;
        }

        .material-style .account-settings-links .list-group-item {
            padding: 0.85rem 1.5rem;
            border-color: rgba(24, 28, 33, 0.03) !important;
        }

        .material-style .account-settings-links .list-group-item.active {
            color: #4e5155 !important;
        }

        .dark-style .account-settings-links .list-group-item {
            padding: 0.85rem 1.5rem;
            border-color: rgba(255, 255, 255, 0.03) !important;
        }

        .dark-style .account-settings-links .list-group-item.active {
            color: #fff !important;
        }

        .light-style .account-settings-links .list-group-item.active {
            color: #4E5155 !important;
        }

        .light-style .account-settings-links .list-group-item {
            padding: 0.85rem 1.5rem;
            border-color: rgba(24, 28, 33, 0.03) !important;
        }

        .btn-cancel:hover {
            background-color: #f5f5f5;
        }

        .btn-setting {
            margin-bottom: 30px;
            margin-right: 30px
        }

        .image-gallery {
            display: none;
            
            display: flex;
            flex-wrap: wrap;
        }

        .image-gallery img {
            width: 100px;
            height: 100px;
            margin: 5px;
            cursor: pointer;
            border-radius: 5px;
            object-fit: cover
        }

        .image-gallery img:hover {
            transform: scale(1.1);
        }

        .btn-select {
            margin-left: 15px;
        }

        .label-setting {
            padding-top: 20px;
            padding-bottom: 2px;
            padding-left: 25px;
        }

        /* .label{
            padding-top: 2px;
            padding:20px;
        } */


        @media only screen and (max-width: 600px) {
            .btn-setting {
                margin-bottom: 20px;
                margin-right: 20px
            }

            .btn-select {
                margin-top: 15px;
                margin-left: 15px;
            }

            .image-gallery img {
                width: 80px;
                height: 80px;
                margin: 5px;
                cursor: pointer;
                border-radius: 5px;
                object-fit: cover
            }
        }
    </style>

    <script>
        function previewImage(event, previewId) {
            const file = event.target.files[0];
            const preview = document.getElementById(previewId);

            if (file) {
                const reader = new FileReader();

                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                }

                reader.readAsDataURL(file);
            } else {
                preview.src = '#';
                preview.style.display = 'none';
            }
        }

        document.getElementById("chooseImageBtn").onclick = function() {
            var gallery = document.getElementById("imageGallery");
            if (gallery.style.display === "none" || gallery.style.display === "") {
                gallery.style.display = "flex";
            } else {
                gallery.style.display = "none";
            }
        }

        function selectImage(imgElement) {
            var preview = document.getElementById('preview1');
            var defaultImageInput = document.getElementById('defaultImage');

            // Cập nhật hình ảnh preview và input ẩn
            preview.src = imgElement.src;
            defaultImageInput.value = imgElement.src;

        }
    </script>
</head>

<body inmaintabuse="1">
    <!-- Header Section -->
    <?php include '../php/header_home_en.php' ?>

    <!-- Cart Section -->
    <?php include '../en/cart.php' ?>

    <div style="margin-top:20px" class="container light-style flex-grow-1 container-p-y">
        
        <h4 class="font-weight-bold py-3 mb-4">
            Account settings
        </h4>
        <div class="card overflow-hidden">
            <div class="row no-gutters row-bordered row-border-light">
                <div class="col-md-3 pt-0">
                    <div class="list-group list-group-flush account-settings-links">
                        <a class="list-group-item list-group-item-action " href="general.php">General</a>
                        <a class="list-group-item list-group-item-action active" href="Image.php">Image</a>
                        <a class="list-group-item list-group-item-action" href="ChangePassword.php">Change password</a>
                        <a class="list-group-item list-group-item-action" href="Information.php">Information</a>
                        <a class="list-group-item list-group-item-action" href="SocialLinks.php">Social links</a>
                        <a class="list-group-item list-group-item-action" href="Connections.php">Connections</a>
                        <a class="list-group-item list-group-item-action" href="Notifications.php">Notifications</a>
                        <a class="list-group-item list-group-item-action" href="Languages.php">Languages</a>
                    </div>
                </div>
                <div class="col-md-9">
                    <div class="tab-content">
                        <div class="tab-pane fade active show" id="account-general">
                            <form action="../php/ChangeImage.php" method="POST" enctype="multipart/form-data"
                                id="accountForm">
                                <?php
                                // session_start();
                                if (isset($_SESSION['success_message'])) {
                                    echo '<div style="margin-top:30px; margin-right:20px" class="alert alert-success">' . $_SESSION['success_message'] . '</div>';
                                    unset($_SESSION['success_message']); // Xóa thông báo sau khi hiển thị
                                }
                                ?>

                                <div class="card-body media align-items-center">
                                    <?php if ($userLogin['image']): ?>
                                        <img style="border-radius: 50%; object-fit: cover" id="preview1"
                                            src="../user/<?php echo $userLogin['image'] ?>" height="200" width="200">
                                    <?php else: ?>
                                        <img style="border-radius: 50%; object-fit: cover" id="preview1"
                                            src="../user/male.png" height="200" width="200">
                                    <?php endif; ?>
                                    <div class="media-body ml-4">
                                        <label class="btn btn-outline-primary btn-select">
                                            Upload new photo
                                            <input type="file" class="account-settings-fileinput" name="profileImage"
                                                onchange="previewImage(event, 'preview1')">
                                        </label>

                                        <input type="hidden" name="userID" value="<?php echo $userLogin['userID'] ?>">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label style="padding-left: 10px;" class="form-label"><strong>Or Choose Default images:</strong></label><br>
                                    <label class="form-label label-setting">People:</label>
                                    <div id="imageGallery" class="image-gallery">
                                        <img src="../user/male.png" alt="Default Image 1" onclick="selectImage(this)">
                                        <img src="../user/female.jpg" alt="Default Image 2" onclick="selectImage(this)">
                                    </div>

                                    <label class="form-label label-setting">Cute:</label>
                                    <div id="imageGallery" class="image-gallery">
                                        <img src="../user/BinhQuyen.jpg" alt="Default Image 10"
                                            onclick="selectImage(this)">
                                        <img src="../user/HuuDat.jpg" alt="Default Image 11"
                                            onclick="selectImage(this)">
                                        <img src="../user/ThuyKhanh.jpg" alt="Default Image 12"
                                            onclick="selectImage(this)">
                                        <img src="../user/ThuyLinh.jpg" alt="Default Image 13"
                                            onclick="selectImage(this)">
                                        <img src="../user/HuuDat1.jpg" alt="Default Image 14"
                                            onclick="selectImage(this)">
                                    </div>


                                    <label class="form-label label-setting">Lego
                                        Ninjago:</label>
                                    <div id="imageGallery" class="image-gallery">
                                        <img src="../user/Gamadon.jpg" alt="Default Image 3"
                                            onclick="selectImage(this)">
                                        <img src="../user/Kai.jpg" alt="Default Image 4" onclick="selectImage(this)">
                                        <img src="../user/Jay.jpg" alt="Default Image 5" onclick="selectImage(this)">
                                        <img src="../user/Cole.jpg" alt="Default Image 6" onclick="selectImage(this)">
                                        <img src="../user/Zane.jpg" alt="Default Image 7" onclick="selectImage(this)">
                                        <img src="../user/Lloyd.jpg" alt="Default Image 8" onclick="selectImage(this)">
                                        <img src="../user/nya.jpg" alt="Default Image 9" onclick="selectImage(this)">
                                    </div>
                                    <!-- Thêm nhiều ảnh khác tùy ý -->
                                </div>
                        </div>
                        <!-- Thêm phần chọn ảnh mặc định -->

                        <input type="hidden" name="defaultImage" id="defaultImage">


                        <div class="text-right mt-3">
                            <button type="submit" class="btn btn-primary btn-setting">Save
                                changes</button>
                            <button type="button" class="btn btn-default btn-cancel btn-setting"
                                id="cancelButton">Cancel</button>
                            <!-- Nút Đăng Xuất -->
                            <a href="../php/logout.php" class="btn btn-danger btn-setting">Logout</a>
                        </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    </div>
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.5.0/dist/js/bootstrap.bundle.min.js"></script>

    <script>
        let isFormDirty = false;

        document.querySelectorAll('input').forEach((input) => {
            input.addEventListener('change', () => {
                isFormDirty = true;
            });
        });

        document.getElementById('accountForm').addEventListener('submit', function() {
            isFormDirty = false;
        });

        document.getElementById('cancelButton').addEventListener('click', function() {
            isFormDirty = false;
            location.reload();
        });

        window.addEventListener('beforeunload', function(e) {
            if (isFormDirty) {
                const confirmationMessage = 'You have unsaved changes. Are you sure you want to leave this page?';
                e.returnValue = confirmationMessage; // Gecko, Trident, Chrome 34+
                return confirmationMessage; // Gecko, WebKit, Chrome <34
            }
        });
    </script>
</body>
    <!-- Footer Section -->
    <?php include '../en/footer.php' ?>
</html>