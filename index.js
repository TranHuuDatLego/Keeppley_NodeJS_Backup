

// Import các thư viện cần thiết
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session'); // Import express-session
const bcrypt = require('bcrypt');
const moment = require('moment');

const loginFacebook = require('./login_facebook'); // Import file Facebook Login
const conn = require('./connectDB');

// Khởi tạo ứng dụng Express
const app = express();

// Cấu hình view engine là EJS
app.set('view engine', 'ejs');

// Cấu hình thư mục views và engine
app.set('views', path.join(__dirname, 'views'));


// Lấy thư mục ảnh
app.use(express.static(path.join(__dirname, 'public')));

// Hàm để phục vụ tệp hình ảnh
const getImage = (res, imagePath) => {
  // Xác định kiểu nội dung dựa trên phần mở rộng tệp
  const extname = String(path.extname(imagePath)).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    // Thêm các kiểu MIME khác nếu cần
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(imagePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(getMessageHTML('Hình ảnh không tồn tại!', true));
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
};

// Middleware để parse dữ liệu form
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: true
}));

// --------------------------------------------------------------------------- //

const loginHandler = require('./login'); // Import loginHandler từ login.js

// Sử dụng loginHandler cho route /login
app.post('/login', loginHandler);

const userRoutes = require('./user'); // Nhập file user.js
// Sử dụng các route từ user.js
app.use(userRoutes);

function auth_user(req, res, next) {
  // Kiểm tra nếu userLogin có tồn tại trong session, nếu không thì gán userID = -1
  res.locals.userLogin = req.session.userLogin ? req.session.userLogin : { userID: -1 };
  res.locals.success_message = req.session.success_message || null; // Gắn thông báo thành công vào res.locals nếu có

  next();
}


// Middleware lấy giỏ hàng của người dùng
const cartMiddleware = async (req, res, next) => {
  const user_id = res.locals.userLogin?.userID || -1;  // Lấy user_id từ session nếu người dùng đã đăng nhập
  let cartItems = [];
  let totalAmount = 0;

  if (user_id) {
    const sqlCart = `
      SELECT c.p_id, c.p_image, c.p_name, c.p_type, c.p_price, c.quantity, 
             (c.p_price * c.quantity) AS total_price
      FROM cart c
      WHERE c.user_id = ?
    `;

    try {
      // Lấy dữ liệu giỏ hàng từ cơ sở dữ liệu
      const results = await new Promise((resolve, reject) => {
        conn.query(sqlCart, [user_id], (err, results) => {
          if (err) reject(err);
          resolve(results);
        });
      });

      // Nếu có sản phẩm trong giỏ hàng
      if (results.length > 0) {
        cartItems = results.map(item => {
          totalAmount += item.total_price;
          return {
            p_id: item.p_id,
            p_name: item.p_name,
            p_image: item.p_image,
            p_type: item.p_type,
            p_price: item.p_price,
            quantity: item.quantity,
            total_price: item.total_price
          };
        });
      }
    } catch (err) {
      console.error("Error fetching cart data: " + err.stack);
    }
  }

  // Lưu trữ giỏ hàng và tổng tiền vào biến `res.locals` để sử dụng trong view
  res.locals.cartItems = cartItems;
  res.locals.totalAmount = totalAmount;

  // Chuyển sang middleware tiếp theo
  next();
};

// Sử dụng middleware cho các route cần giỏ hàng
app.use(cartMiddleware);  // Tất cả các route sẽ được thêm giỏ hàng vào `res.locals`



// Định nghĩa route với middleware auth_user
app.get('/', auth_user, cartMiddleware, (req, res) => {
  const website = 'index.ejs'; // Lấy tên file từ URL
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  console.log(userLogin)
  // Truy vấn danh sách sản phẩm của từng nhà cung cấp
  const sqlQman = "SELECT * FROM `category` WHERE `provider` = 'Qman'";
  const sqlKeeppley = "SELECT * FROM `category` WHERE `provider` = 'Keeppley'";
  const sqlLEGO = "SELECT * FROM `category` WHERE `provider` = 'LEGO'";

  // Dùng Promise để chạy các truy vấn đồng thời và đợi tất cả hoàn thành
  Promise.all([
    new Promise((resolve, reject) => {
      conn.query(sqlQman, (err, results) => {
        if (err) reject("Error querying Qman: " + err.stack);
        else resolve(results.map(category => ({
          id: category.id,
          name: category.name_en,
          images: category.images ? category.images.split(',').map(img => img.trim()) : [] // Tách chuỗi hình ảnh thành mảng
        })).slice(0, 4)); // Lấy 4 mục đầu tiên
      });
    }),
    new Promise((resolve, reject) => {
      conn.query(sqlKeeppley, (err, results) => {
        if (err) reject("Error querying Keeppley: " + err.stack);
        else resolve(results.map(category => ({
          id: category.id,
          name: category.name_en,
          images: category.images ? category.images.split(',').map(img => img.trim()) : []
        })).slice(0, 4)); // Lấy 4 mục đầu tiên
      });
    }),
    new Promise((resolve, reject) => {
      conn.query(sqlLEGO, (err, results) => {
        if (err) reject("Error querying LEGO: " + err.stack);
        else resolve(results.map(category => ({
          id: category.id,
          name: category.name_en,
          images: category.images ? category.images.split(',').map(img => img.trim()) : []
        })).slice(0, 4)); // Lấy 4 mục đầu tiên
      });
    })
  ])
    .then(([qmanCategories, keeppleyCategories, legoCategories]) => {
      // Render view và truyền dữ liệu categories vào EJS
      res.render('index', { website, userLogin, cartItems, qmanCategories, keeppleyCategories, legoCategories });
    })
    .catch(error => {
      console.error(error);
      res.status(500).send("Database query error");
    });
});


app.get('/ChooseLogin_en', auth_user, cartMiddleware, (req, res) => {
  const website = 'ChooseLogin_en.ejs'; // Lấy tên file từ URL
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('ChooseLogin_en', { website, userLogin, cartItems });
});


app.get('/404', auth_user, cartMiddleware, (req, res) => {
  const website = '404.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('404', { website, userLogin, cartItems });
});


// Đơn hàng chi tiết
app.get('/QRCode/:id', auth_user, cartMiddleware, (req, res) => {
  const website = 'QRCode.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems; // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount; // Tổng số tiền giỏ hàng
  const o_id = req.params.id;  // Lấy id từ URL

  console.log('Order ID:', o_id);

  // Truy vấn chi tiết đơn hàng và thông tin đơn hàng từ bảng order
  const detailQuery = `
    SELECT 
      od.p_id, od.p_image, od.price, od.quantity, od.p_name,
      o.fullname, o.address, o.delivery, o.total, o.order_date
    FROM order_detail AS od
    JOIN \`order\` AS o ON od.o_id = o.o_id
    WHERE od.o_id = ?
  `;

  conn.query(detailQuery, [o_id], (err, detailResults) => {
    if (err) {
      console.error('Error querying order details:', err);
      return res.status(500).send('Database error');
    }

    // Truyền dữ liệu vào view
    res.render('QRCode', {
      website,
      userLogin,
      cartItems,
      totalAmount,
      orderDetails: detailResults, // Truyền chi tiết đơn hàng vào view
      o_id,  // Truyền ID đơn hàng
      fullname: detailResults[0]?.fullname, // Truyền tên người nhận
      address: detailResults[0]?.address,   // Truyền địa chỉ giao hàng
      delivery: detailResults[0]?.delivery, // Truyền phương thức giao hàng
      orderTotal: detailResults[0]?.total,  // Truyền tổng tiền
      orderDate: detailResults[0]?.order_date // Truyền ngày đặt hàng
    });
  });
});
app.post('/change-password', cartMiddleware, async (req, res) => {
  const { userID, current_password, new_password, repeat_new_password } = req.body;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware

  // Xóa thông báo trước đó
  req.session.success_message = null;
  req.session.error_pass0 = null;
  req.session.error_pass1 = null;

  try {
      // 1. Lấy mật khẩu hiện tại từ cơ sở dữ liệu
      const sql = "SELECT loginpassword FROM User WHERE userID = ?";
      conn.query(sql, [userID], async (err, results) => {
          if (err) {
              console.error("Lỗi truy vấn:", err);
              return res.status(500).send("Có lỗi xảy ra.");
          }

          if (results.length === 0) {
              req.session.error_pass0 = "Tài khoản không tồn tại.";
              return res.redirect('/change-password');
          }

          const hashedPassword = results[0].loginpassword;

          // 2. Kiểm tra mật khẩu hiện tại
          const isMatch = await bcrypt.compare(current_password, hashedPassword);
          if (!isMatch) {
              error_message = "Mật khẩu hiện tại không đúng.";
              success_message = ''
              const website = 'Password.ejs';
              res.render('Password', { userLogin: req.session.userLogin, error_message, success_message, website });
          }

          // 3. Kiểm tra mật khẩu mới và mật khẩu xác nhận
          if (new_password !== repeat_new_password) {
              error_message = "Mật khẩu mới không khớp.";
              success_message = ''
              const website = 'Password.ejs';
              const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
              const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng;
              res.render('Password', { userLogin: req.session.userLogin, error_message, success_message, website, cartItems });

          }

          // 4. Mã hóa và cập nhật mật khẩu mới
          const newHashedPassword = await bcrypt.hash(new_password, 10);
          const updateSql = "UPDATE User SET loginpassword = ? WHERE userID = ?";
          conn.query(updateSql, [newHashedPassword, userID], (updateErr) => {
              if (updateErr) {
                  console.error("Lỗi cập nhật mật khẩu:", updateErr);
                  return res.status(500).send("Có lỗi xảy ra.");
              }

              // Thông báo thành công
              error_message = ''
              success_message = "Cập nhật mật khẩu thành công!";
              // Cập nhật ảnh trong session
              const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
              const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng;
              const website = 'Password.ejs';
              res.render('Password', { userLogin: req.session.userLogin, error_message, success_message, website, cartItems  });
          });
      });
  } catch (err) {
      console.error("Lỗi hệ thống:", err);
      res.status(500).send("Có lỗi xảy ra.");
  }
});


// Route xử lý '/Category_Product' với middleware auth_user
app.get('/Category_Product', auth_user, cartMiddleware, (req, res) => {
  const website = 'Category_Product.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng;
  const id = req.query.id; // Lấy `id` từ query parameter

  // Truy vấn chi tiết danh mục dựa trên `id`
  const sqlCategory = "SELECT * FROM `category` WHERE `id` = ?";
  conn.query(sqlCategory, [id], (err, resultCategory) => {
    if (err) {
      console.error("Error querying database: " + err.stack);
      return res.status(500).send("Database query error");
    }

    if (resultCategory.length > 0) {
      const category = resultCategory[0];
      const categoryNameEn = category.name_en;
      const categoryImages = category.images.split(',').map(img => img.trim());

      // Truy vấn chi tiết sản phẩm dựa trên `p_category`
      const sqlProduct = "SELECT * FROM `product` WHERE `p_category` = ?";
      conn.query(sqlProduct, [categoryNameEn], (err, resultProduct) => {
        if (err) {
          console.error("Error querying products: " + err.stack);
          return res.status(500).send("Database query error");
        }

        // Gán kết quả vào mảng `products`
        const products = resultProduct.map(row => ({
          id: row.p_id,
          number: row.p_number,
          image: row.p_image,
          nameEn: row.p_name_en,
          nameVn: row.p_name_vn,
          priceEn: row.p_price_en,
          discount: row.p_discount,
          priceVn: row.p_price_vn,
          tutorial: row.p_tutorial,
          category: row.p_category,
          description: row.p_description,
          images: row.p_image ? row.p_image.split(',').map(img => img.trim()) : []
        }));

        // Truy vấn để xác định nhà cung cấp
        const sqlProvider = "SELECT * FROM `category` WHERE `name_en` = ?";
        conn.query(sqlProvider, [categoryNameEn], (err, resultProvider) => {
          if (err) {
            console.error("Error querying provider: " + err.stack);
            return res.status(500).send("Database query error");
          }

          let categoryWebsite = '';
          if (resultProvider.length > 0) {
            const provider = resultProvider[0].provider;
            if (provider === 'Keeppley') {
              categoryWebsite = 'Keeppley-Products.php';
            } else if (provider === 'Qman') {
              categoryWebsite = 'Qman-Products.php';
            } else if (provider === 'LEGO') {
              categoryWebsite = 'LEGO-Products.php';
            }
          }

          // Render view và truyền dữ liệu vào EJS
          res.render('Category_Product', {
            website,
            userLogin,
            category,
            categoryImages,
            products,
            categoryWebsite
          });
        });
      });
    } else {
      // Không tìm thấy danh mục với `id` được cung cấp
      res.status(404).send("Không tìm thấy danh mục với id là " + id);
    }
  });
});


app.get('/Connections', auth_user, cartMiddleware, (req, res) => {
  const website = 'Connections.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Connections', { website, userLogin, cartItems });
});


app.get('/footer', auth_user, cartMiddleware, (req, res) => {
  const website = 'footer.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('footer', { website, userLogin, cartItems });
});

app.get('/footer_dark', auth_user, cartMiddleware, (req, res) => {
  const website = 'footer_dark.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('footer_dark', { website, userLogin, cartItems });
});

app.get('/form_login_en', auth_user, cartMiddleware, (req, res) => {
  const website = 'form_login_en.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  const successMessage = ''
  const errorMessage = ''
  res.render('form_login_en', { website, userLogin, cartItems, successMessage, errorMessage });
});

// --------------------------------------------------------------------------- //

const { upload, changeGeneral } = require('./changeGeneral');

// Sử dụng middleware để xử lý yêu cầu cập nhật thông tin người dùng
app.post('/changeGeneral', upload.single('profileImage'), changeGeneral);


app.get('/General', auth_user, cartMiddleware, (req, res) => {
  const website = 'General.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('General', { website, userLogin, cartItems });
});

app.get('/Avatar', auth_user, cartMiddleware, (req, res) => {
  const website = '/Avatar.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Avatar', { website, userLogin, cartItems });
});

const { upload: avatarUpload, changeAvatar } = require('./changeAvatar');


// Định tuyến đến trang avatar và cập nhật ảnh
app.post('/changeAvatar', avatarUpload.single('profileImage'), (req, res) => {
  changeAvatar(req, res);
});


const countryList = require('./countryList'); // Đường dẫn đến file countryList.js
// Tích hợp Facebook Login
loginFacebook(app);


// Trong tệp router hoặc controller
function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
}

// Sử dụng trong route
app.get('/Information', auth_user, cartMiddleware, (req, res) => {
  const website = 'Information.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng;
  const error_message = '';
  const success_message = '';


  res.render('Information', { website, userLogin, cartItems, error_message, success_message, countryList });
});


const informationRouter = require('./updateInformation');
app.use('/', informationRouter);


app.get('/Languages', auth_user, cartMiddleware, (req, res) => {
  const website = 'Languages.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Languages', { website, userLogin, cartItems });
});

// Route để lấy danh sách sản phẩm và render ra trang
app.get('/LEGO_Products', auth_user, cartMiddleware, (req, res) => {
  const website = 'LEGO_Products.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng

  const sqlLEGO = "SELECT * FROM `category` WHERE `provider` = 'LEGO'";

  conn.query(sqlLEGO, (err, results) => {
    if (err) {
      console.error("Error querying database: " + err.stack);
      return res.status(500).send("Database query error");
    }

    // Gán kết quả truy vấn vào mảng categories và render view
    const categories = results.map(category => {
      return {
        id: category.id,
        name: category.name_en,
        images: category.images.split(',').map(img => img.trim()) // Tách chuỗi hình ảnh thành mảng
      };
    });

    // Render view và truyền dữ liệu categories vào EJS
    res.render('LEGO_Products', { website, userLogin, cartItems, categories });
  });
});

app.get('/Password', auth_user, cartMiddleware, (req, res) => {
  const website = 'Password.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  const error_message = ''
  const success_message = ''
  res.render('Password', { website, userLogin, cartItems, error_message, success_message });
});

app.get('/view-cart', auth_user, cartMiddleware, (req, res) => {
  console.log('req.session', req.session)
  const website = 'view-cart.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  const discountApplied = req.session.discountApplied || 0;
  const errorMessage = req.query.error || "";
  const total = req.session.total || 0;
  res.render('view-cart', { website, userLogin, cartItems, discountApplied, total, errorMessage });
});

app.get('/Notifications', auth_user, cartMiddleware, (req, res) => {
  const website = 'Notifications.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Notifications', { website, userLogin, cartItems });
});

app.get('/Signup_en', auth_user, cartMiddleware, (req, res) => {
  const website = 'Signup_en.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Signup_en', { website, userLogin, cartItems });
});

// Xử lý đăng ký
app.post('/register', (req, res) => {
  const { userName, email, password } = req.body;
  const website = 'register.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng;

  // Truy vấn để kiểm tra xem userName đã tồn tại hay chưa
  const checkQuery = "SELECT * FROM `user` WHERE `userName` = ?";
  conn.query(checkQuery, [userName], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Registration failed" });
    }

    // Nếu userName đã tồn tại, gửi thông báo lỗi
    if (results.length > 0) {
      const successMessage = '';
      return res.render('form_login_en', { website, userLogin, cartItems, errorMessage: "Username is already taken.", successMessage });
    }

    // Hash mật khẩu trước khi lưu vào cơ sở dữ liệu
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Registration failed" });
      }

      // Nếu userName chưa tồn tại, tiếp tục đăng ký người dùng với mật khẩu đã được hash
      const query = "INSERT INTO `user` (`userName`, `email`, `loginpassword`) VALUES (?, ?, ?)";
      conn.query(query, [userName, email, hashedPassword], (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Registration failed" });
        }

        const errorMessage = '';
        res.render('form_login_en', { website, userLogin, cartItems, errorMessage, successMessage: "User registered successfully." });
      });
    });
  })
})

// Route để lấy danh sách sản phẩm mới và render ra trang
app.get('/new_arrivals', auth_user, cartMiddleware, (req, res) => {
  const website = 'new_arrivals.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng;

  // Lấy số trang từ query và thiết lập số lượng sản phẩm mỗi trang
  const page = parseInt(req.query.page) || 1; // Mặc định là trang 1 nếu không có query
  const limit = 20; // Số sản phẩm mỗi trang
  const offset = (page - 1) * limit; // Tính vị trí bắt đầu của sản phẩm

  // Tổng số sản phẩm (để tính tổng số trang)
  const sqlCount = `
  SELECT COUNT(*) AS total 
  FROM product 
  WHERE p_product_status = 'new'
`;


  conn.query(sqlCount, (err, resultCount) => {
    if (err) {
      console.error("Error counting products: " + err.stack);
      return res.status(500).send("Database query error");
    }

    const totalProducts = resultCount[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    // Truy vấn sản phẩm theo giới hạn và phân trang
    const sqlProducts = `
    SELECT * 
    FROM product 
    WHERE	p_product_status = 'new'
    LIMIT ${limit} OFFSET ${offset}
`;

    conn.query(sqlProducts, (err, resultProducts) => {
      if (err) {
        console.error("Error querying products: " + err.stack);
        return res.status(500).send("Database query error");
      }

      res.render('new_arrivals', {
        website,
        userLogin,
        products: resultProducts,
        currentPage: page,
        totalPages
      });
    });
  });
});

// Route để lấy danh sách sản phẩm giảm giá và render ra trang
app.get('/discount', auth_user, cartMiddleware, (req, res) => {
  const website = 'discount.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng;

  // Lấy số trang từ query và thiết lập số lượng sản phẩm mỗi trang
  const page = parseInt(req.query.page) || 1; // Mặc định là trang 1 nếu không có query
  const limit = 20; // Số sản phẩm mỗi trang
  const offset = (page - 1) * limit; // Tính vị trí bắt đầu của sản phẩm

  // Tổng số sản phẩm (để tính tổng số trang)
  const sqlCount = `
    SELECT COUNT(*) AS total 
    FROM product 
    WHERE p_discount > 0 
    ORDER BY p_discount DESC
`;

  conn.query(sqlCount, (err, resultCount) => {
    if (err) {
      console.error("Error counting products: " + err.stack);
      return res.status(500).send("Database query error");
    }

    const totalProducts = resultCount[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    // Truy vấn sản phẩm theo giới hạn và phân trang
    const sqlProducts = `
    SELECT * 
    FROM product 
    WHERE p_discount > 0 
    ORDER BY p_discount DESC 
    LIMIT ${limit} OFFSET ${offset}
`;

    conn.query(sqlProducts, (err, resultProducts) => {
      if (err) {
        console.error("Error querying products: " + err.stack);
        return res.status(500).send("Database query error");
      }

      res.render('discount', {
        website,
        userLogin,
        products: resultProducts,
        currentPage: page,
        totalPages
      });
    });
  });
});

// Route để lấy danh sách sản phẩm và render ra trang
app.get('/product', auth_user, cartMiddleware, (req, res) => {
  const website = 'product.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng;

  // Lấy số trang từ query và thiết lập số lượng sản phẩm mỗi trang
  const page = parseInt(req.query.page) || 1; // Mặc định là trang 1 nếu không có query
  const limit = 20; // Số sản phẩm mỗi trang
  const offset = (page - 1) * limit; // Tính vị trí bắt đầu của sản phẩm

  // Tổng số sản phẩm (để tính tổng số trang)
  const sqlCount = 'SELECT COUNT(*) AS total FROM product';

  conn.query(sqlCount, (err, resultCount) => {
    if (err) {
      console.error("Error counting products: " + err.stack);
      return res.status(500).send("Database query error");
    }

    const totalProducts = resultCount[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    // Truy vấn sản phẩm theo giới hạn và phân trang
    const sqlProducts = `
    SELECT * 
    FROM product 
    ORDER BY RAND() 
    LIMIT ${limit} OFFSET ${offset}
`;
    conn.query(sqlProducts, (err, resultProducts) => {
      if (err) {
        console.error("Error querying products: " + err.stack);
        return res.status(500).send("Database query error");
      }

      res.render('product', {
        website,
        userLogin,
        products: resultProducts,
        currentPage: page,
        totalPages
      });
    });
  });
});


app.get('/Product_Detail', auth_user, cartMiddleware, async (req, res) => {
  const website = 'Product_Detail.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems; // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount; // Tổng số tiền giỏ hàng;
  const p_id = req.query.id; // Lấy p_id từ query string

  // Câu truy vấn lấy thông tin sản phẩm
  const sqlProduct = `SELECT * FROM product WHERE p_id = ?`;

  // Câu truy vấn lấy group_id và các sản phẩm liên quan
  const sqlGroupProduct = `
    SELECT gp.group_id, gp.product_id, p.p_name_en, p.p_image
    FROM group_product gp
    JOIN product p ON gp.product_id = p.p_id
    WHERE gp.group_id = (
        SELECT group_id
        FROM group_product
        WHERE product_id = ?
    );
  `;

  try {
    // Truy vấn lấy thông tin sản phẩm
    const resultProduct = await new Promise((resolve, reject) => {
      conn.query(sqlProduct, [p_id], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    if (resultProduct.length === 0) {
      return res.status(404).send("Product not found");
    }

    // Định nghĩa sản phẩm hiện tại
    const product = resultProduct[0];
    const productImages = product.p_image.split(',').map(img => img.trim());

    // Kiểm tra và gán lại giá trị nếu ảnh thứ 2 và thứ 3 trống
    if (!productImages[1]) productImages[1] = productImages[0];
    if (!productImages[2]) productImages[2] = productImages[0];

    // Truy vấn lấy group_id và tất cả sản phẩm liên quan
    const groupProducts = await new Promise((resolve, reject) => {
      conn.query(sqlGroupProduct, [p_id], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    // Truy vấn thêm thông tin category
    const sqlCategory = `SELECT * FROM category WHERE name_en = ?`;
    const resultCategory = await new Promise((resolve, reject) => {
      conn.query(sqlCategory, [product.p_category], (err, resultCategory) => {
        if (err) reject(err);
        resolve(resultCategory);
      });
    });

    const provider = resultCategory[0]?.provider;

    // Xử lý kết quả groupProducts
    const group = groupProducts.length > 0 ? groupProducts : [{ group_id: 0, p_name_en: "Default" }];
    const sqlComments = `
    SELECT c.id, c.rank, c.detail, c.created_at, u.username 
    FROM comment c
    JOIN user u ON c.userid = u.userID
    WHERE c.productid = ?
    ORDER BY c.created_at DESC
  `;

    const comments = await new Promise((resolve, reject) => {
      conn.query(sqlComments, [p_id], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });
    // Render trang chi tiết sản phẩm
    res.render('Product_Detail', {
      website,
      userLogin,
      cartItems,
      totalAmount,
      product,
      provider,
      productImages,
      group,
      comments
    });
  } catch (err) {
    console.error("Database query error: " + err.stack);
    res.status(500).send("Database query error");
  }
});
app.post('/Product_Detail/addComment', auth_user, async (req, res) => {
  const { product_id, user_id, rank, comment_detail } = req.body;
  // Kiểm tra dữ liệu đầu vào
  if (!product_id || !user_id || !rank || !comment_detail) {
    return res.status(400).send("Missing required fields");
  }

  const sqlAddComment = `
    INSERT INTO comment (productid, userid, rank, detail, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;

  try {
    // Lưu bình luận vào cơ sở dữ liệu
    await new Promise((resolve, reject) => {
      conn.query(sqlAddComment, [product_id, user_id, rank, comment_detail], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    // Redirect lại trang chi tiết sản phẩm
    res.redirect(`/Product_Detail?id=${product_id}`);
  } catch (err) {
    console.error("Error adding comment: ", err);
    res.status(500).send("Error adding comment");
  }
});
// Thêm giỏ hàng
app.post('/buy-now', auth_user, cartMiddleware, (req, res) => {
  const { p_id, p_name, p_type, quantity, p_price, p_image } = req.body; // Nhận giá trị từ frontend
  const user_id = res.locals.userLogin.userID || -1; // ID người dùng từ session

  const sqlCheckCart = `
    SELECT quantity 
    FROM cart 
    WHERE user_id = ? AND p_id = ?
  `;

  conn.query(sqlCheckCart, [user_id, p_id], (err, result) => {
    if (err) {
      console.error("Error checking cart: " + err.stack);
      return res.status(500).send("Database error");
    }

    if (result.length > 0) {
      // Nếu sản phẩm đã tồn tại, cộng dồn quantity
      const newQuantity = result[0].quantity + parseInt(quantity);

      const sqlUpdateCart = `
        UPDATE cart 
        SET quantity = ? 
        WHERE user_id = ? AND p_id = ?
      `;
      conn.query(sqlUpdateCart, [newQuantity, user_id, p_id], (err) => {
        if (err) {
          console.error("Error updating cart: " + err.stack);
          return res.status(500).send(`
            <script>
              alert("An error occurred while updating the cart. Please try again later.");
              window.location.href = "/view-cart}";
            </script>
          `);
        }

        // Trả về thông báo thành công
        return res.send(`
          <script>
            alert("Product quantity updated in cart successfully");
            window.location.href = "/view-cart";
          </script>
        `);
      });
    } else {
      // Nếu sản phẩm chưa tồn tại, thêm mới vào giỏ hàng
      const sqlInsertCart = `
        INSERT INTO cart (user_id, p_id, p_name, p_price, p_image, p_type, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      conn.query(sqlInsertCart, [user_id, p_id, p_name, p_price, p_image, p_type, quantity], (err) => {
        if (err) {
          console.error("Error adding to cart: " + err.stack);
          return res.status(500).send(`
            <script>
              alert("An error occurred while adding the product to the cart. Please try again later.");
              window.location.href = "/view-cart";
            </script>
          `);
        }

        // Trả về thông báo thành công
        res.send(`
          <script>
            alert("Product added to cart successfully");
            window.location.href = "/Product_Detail?id=${p_id}";
          </script>
        `);
      });
    }
  });
});

// Thêm giỏ hàng
app.post('/add-to-cart', auth_user, cartMiddleware, (req, res) => {
  const { p_id, p_name, p_type, quantity, p_price, p_image } = req.body; // Nhận giá trị từ frontend
  const user_id = res.locals.userLogin.userID || -1; // ID người dùng từ session

  const sqlCheckCart = `
    SELECT quantity 
    FROM cart 
    WHERE user_id = ? AND p_id = ?
  `;

  conn.query(sqlCheckCart, [user_id, p_id], (err, result) => {
    if (err) {
      console.error("Error checking cart: " + err.stack);
      return res.status(500).send("Database error");
    }

    if (result.length > 0) {
      // Nếu sản phẩm đã tồn tại, cộng dồn quantity
      const newQuantity = result[0].quantity + parseInt(quantity);

      const sqlUpdateCart = `
        UPDATE cart 
        SET quantity = ? 
        WHERE user_id = ? AND p_id = ?
      `;
      conn.query(sqlUpdateCart, [newQuantity, user_id, p_id], (err) => {
        if (err) {
          console.error("Error updating cart: " + err.stack);
          return res.status(500).send(`
            <script>
              alert("An error occurred while updating the cart. Please try again later.");
              window.location.href = "/Product_Detail?id=${p_id}";
            </script>
          `);
        }

        // Trả về thông báo thành công
        return res.send(`
          <script>
            alert("Product quantity updated in cart successfully");
            window.location.href = "/Product_Detail?id=${p_id}";
          </script>
        `);
      });
    } else {
      // Nếu sản phẩm chưa tồn tại, thêm mới vào giỏ hàng
      const sqlInsertCart = `
        INSERT INTO cart (user_id, p_id, p_name, p_price, p_image, p_type, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      conn.query(sqlInsertCart, [user_id, p_id, p_name, p_price, p_image, p_type, quantity], (err) => {
        if (err) {
          console.error("Error adding to cart: " + err.stack);
          return res.status(500).send(`
            <script>
              alert("An error occurred while adding the product to the cart. Please try again later.");
              window.location.href = "/Product_Detail?id=${p_id}";
            </script>
          `);
        }

        // Trả về thông báo thành công
        res.send(`
          <script>
            alert("Product added to cart successfully");
            window.location.href = "/Product_Detail?id=${p_id}";
          </script>
        `);
      });
    }
  });
});



// Xóa giỏ hàng
app.post('/delete-cart', auth_user, async (req, res) => {
  const { p_id } = req.body; // Lấy userID và p_id từ body request
  const user_id = res.locals.userLogin.userID || -1; // ID người dùng từ session

  // Kiểm tra dữ liệu hợp lệ
  if (!p_id || user_id === undefined) {
    return res.status(400).json({ success: false, message: 'Invalid data provided' });
  }

  // Câu SQL để xóa sản phẩm từ bảng `cart`
  const sqlDeleteCart = `DELETE FROM cart WHERE user_id = ? AND p_id = ?`;

  try {
    await new Promise((resolve, reject) => {
      conn.query(sqlDeleteCart, [user_id, p_id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    // xóa thành công
    res.send(`
      <script>
        alert("Product on cart deleted successfully");
        window.location.href = "/view-cart";
      </script>
    `);

  } catch (err) {
    console.error('Error deleting cart item:', err);
    res.status(500).send(`
      <script>
        alert("An error occurred while deleting the product to the cart. Please try again later.");
       window.location.href = "/view-cart";
      </script>
    `);
  }
});

// Cập nhật giỏ hàng
app.post('/update-cart', auth_user, async (req, res) => {
  const { p_id, quantity } = req.body; // p_id[] và quantity[] sẽ là mảng
  const user_id = res.locals.userLogin?.userID || -1; // ID người dùng từ session

  //   console.log("p_id:", p_id);
  // console.log("quantity:", quantity);


  try {
    // Duyệt qua từng sản phẩm và xử lý
    for (let i = 0; i < p_id.length; i++) {
      const id = p_id[i];
      const qty = parseInt(quantity[i]);

      if (qty <= 0) {
        // Xóa sản phẩm nếu số lượng <= 0
        await new Promise((resolve, reject) => {
          conn.query('DELETE FROM cart WHERE user_id = ? AND p_id = ?', [user_id, id], (err, results) => {
            if (err) return reject(err);
            resolve(results);
          });
        });
      } else {
        // Cập nhật số lượng
        await new Promise((resolve, reject) => {
          conn.query('UPDATE cart SET quantity = ? WHERE user_id = ? AND p_id = ?', [qty, user_id, id], (err, results) => {
            if (err) return reject(err);
            resolve(results);
          });
        });
      }
    }

    // Lấy lại giỏ hàng
    const rows = await new Promise((resolve, reject) => {
      conn.query('SELECT p_price, quantity FROM cart WHERE user_id = ?', [user_id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (!rows || rows.length === 0) {
      req.session.cartItems = [];
      req.session.totalAmount = 0;
      return res.redirect('/view-cart');
    }

    const cartItems = rows;
    const totalAmount = cartItems.reduce((total, item) => total + item.p_price * item.quantity, 0);

    req.session.cartItems = cartItems;
    req.session.totalAmount = totalAmount;

    res.redirect('/view-cart');
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/use-coupon', auth_user, cartMiddleware, async (req, res) => {
  const couponCode = req.body.couponCode.trim();
  const cartItems = res.locals.cartItems;
  console.log('cartItems', cartItems)
  const user_id = res.locals.userLogin?.userID || -1;
  try {
    const [coupon] = await new Promise((resolve, reject) => {
      conn.query('SELECT * FROM coupon WHERE code = ? AND `condition` = "active" AND validityPeriod >= NOW()', [couponCode], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (!coupon) {
      return res.redirect('/view-cart?error=Coupon is invalid or expired');
    }
    const totalAmount = cartItems.reduce((total, item) => total + item.total_price, 0);
    if (totalAmount < coupon.minimum) {
      return res.redirect('/view-cart?error=Coupon is invalid or expired');
    }
    const discount = coupon.discount;
    console.log('first', discount)
    console.log('totalAmount', totalAmount)
    const discountAmount = (totalAmount * discount) / 100;
    const newTotalAmount = totalAmount - discountAmount;
    console.log('newTotalAmount', newTotalAmount)
    console.log('discountAmount', discountAmount)
    req.session.total = newTotalAmount;
    req.session.discountApplied = discountAmount;

    res.redirect('/view-cart');
  } catch (error) {
    return res.redirect('/view-cart?error=Internal Server Error');
  }
});

// Endpoint để lấy giỏ hàng của người dùng
app.get('/get-cart', auth_user, cartMiddleware, (req, res) => {
  const user_id = res.locals.userLogin.userID;  // Lấy user_id từ session hoặc token
  const sqlCart = `
    SELECT c.p_id, c.p_image, c.p_type, c.p_price, c.quantity, 
           (c.p_price * c.quantity) AS total_price
    FROM cart c
    WHERE c.user_id = ?;
  `;

  conn.query(sqlCart, [user_id], (err, results) => {
    if (err) {
      console.error("Error fetching cart data: " + err.stack);
      return res.status(500).send("Database error");
    }

    if (results.length > 0) {
      let totalAmount = 0;
      const cartItems = results.map(item => {
        totalAmount += item.total_price;
        return {
          p_id: item.p_id,
          p_image: item.p_image,
          p_type: item.p_type,
          p_price: item.p_price,
          quantity: item.quantity,
          total_price: item.total_price
        };
      });

      // Render page with cart items
      res.render('cart_sidebar', { cartItems, totalAmount });
    } else {
      res.render('cart_sidebar', { cartItems: [], totalAmount: 0 });
    }
  });
});

// Cập nhật thông tin và tạo tài khoản
app.post('/update-user-info', (req, res) => {
  const { user_id, fullname, address, phone, username, password } = req.body;
  let finalUsername = username;
  let finalPassword = password;

  if (!finalUsername || !finalPassword) {
    finalUsername = req.session.userLogin.userName;
    finalPassword = req.session.userLogin.password;
  }

  if (user_id == -1) {
    // Nếu user_id = -1, tạo tài khoản mới
    bcrypt.hash(finalPassword, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Error hashing password:', err);
        return res.redirect('/form_login_en');
      }

      // Tạo tài khoản mới
      conn.query(
        'INSERT INTO user (fullname, address, phone, userName, loginpassword) VALUES (?, ?, ?, ?, ?)',
        [fullname, address, phone, finalUsername, hashedPassword],
        (insertErr, insertResult) => {
          if (insertErr) {
            console.error('Error inserting new user:', insertErr);
            return res.redirect('/form_login_en');
          }

          // Lấy thông tin user mới tạo
          conn.query(
            'SELECT * FROM user WHERE username = ?',
            [finalUsername],
            (selectErr, users) => {
              if (selectErr || users.length === 0) {
                console.error('Error fetching new user:', selectErr);
                return res.redirect('/form_login_en');
              }

              const newUser = users[0];
              // Lưu thông tin vào session
              req.session.userLogin = {
                userID: newUser.userID,
                userName: newUser.userName,
                fullname: newUser.fullname,
                email: newUser.email,
                image: newUser.image,
                loginpassword: newUser.loginpassword,
                address: newUser.address,
                bio: newUser.bio,
                country: newUser.country,
                phone: newUser.phone,
              };

              // Chuyển sản phẩm từ user_id = -1 sang user_id mới
              conn.query(
                'UPDATE cart SET user_id = ? WHERE user_id = -1',
                [newUser.userID],
                (updateCartErr) => {
                  if (updateCartErr) {
                    console.error('Error updating cart:', updateCartErr);
                    return res.redirect('/form_login_en');
                  }
                  // Quay lại trang giỏ hàng
                  res.redirect('/view-cart');
                }
              );
            }
          );
        }
      );
    });
  } else {
    // Cập nhật thông tin người dùng đã tồn tại
    conn.query(
      'UPDATE user SET username = ?, address = ?, phone = ? WHERE userID = ?',
      [finalUsername, address, phone, user_id],
      (updateUserErr) => {
        if (updateUserErr) {
          console.error('Error updating user:', updateUserErr);
          return res.redirect('/form_login_en');
        }

        // Cập nhật lại thông tin trong session
        res.locals.userLogin.userName = finalUsername;
        res.locals.userLogin.address = address;
        res.locals.userLogin.phone = phone;

        // Quay lại trang cần thiết
        res.redirect('/form_login_en');
      }
    );
  }
});

// Mua hàng thoi
app.post('/checkout', (req, res) => {
  const website = 'checkout.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  const user_id = req.session.userLogin?.userID || -1;
  const delivery = req.body.delivery || 'normal'; // Mặc định là 'normal'
  const fullname = req.body.fullname || 'normal'; // Mặc định là 'normal'
  const address = req.body.address || 'unknown'; // Mặc định là 'unknown'
  const totalAmount2 = req.body.totalAmount;
  const discountApplied = req.body.discountApplied;
  const phone = req.body.phone;

  if (user_id === -1) {
    return res.status(401).send('User not logged in');
  }

  // 1. Lấy giỏ hàng của người dùng
  conn.query('SELECT * FROM cart WHERE user_id = ?', [user_id], (err, cartItems) => {
    if (err) {
      console.error('Error fetching cart:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (cartItems.length === 0) {
      return res.status(400).send('Cart is empty');
    }

    // 2. Tạo mã o_id (8 số ngày tháng năm + 4 số tự tăng)
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD


    // 3. Lấy giá tổng
    const total = parseFloat((totalAmount2 - discountApplied).toFixed(2));

    console.log(total)

    conn.query('SELECT COUNT(*) AS orderCount FROM `order` WHERE DATE(order_date) = CURDATE()', (err, countResult) => {
      if (err) {
        console.error('Error getting order count:', err);
        return res.status(500).send('Internal Server Error');
      }

      const orderCount = countResult[0].orderCount + 1;
      const o_id = `${datePart}${String(orderCount).padStart(4, '0')}`;


      // 4. Lưu vào bảng order (bao gồm cả delivery, fullname và address)
      conn.query('INSERT INTO `order` (o_id, user_id, total, delivery, fullname, address, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [o_id, user_id, total, delivery, fullname, address, phone],
        (err) => {
          if (err) {
            console.error('Error inserting into order:', err);
            return res.status(500).send('Internal Server Error');
          }

          // 5. Lưu chi tiết đơn hàng vào bảng order_detail
          const orderDetails = cartItems.map((item) => {
            const p_image = item.p_image; // giả sử p_image có trong cartItems
            const p_name = item.p_name;  // lấy tên sản phẩm từ cartItems

            return [o_id, user_id, item.p_id, p_name, item.p_price, item.quantity, p_image];
          });

          conn.query('INSERT INTO order_detail (o_id, user_id, p_id, p_name, price, quantity, p_image) VALUES ?',
            [orderDetails],
            (err) => {
              if (err) {
                console.error('Error inserting into order_detail:', err);
                return res.status(500).send('Internal Server Error');
              }

              // 6. Xóa giỏ hàng sau khi thanh toán
              conn.query('DELETE FROM cart WHERE user_id = ?', [user_id], (err) => {
                if (err) {
                  console.error('Error deleting from cart:', err);
                  return res.status(500).send('Internal Server Error');
                }

                // 7. Gửi phản hồi thành công
                res.render('thankyou', { website, userLogin, cartItems });
              });
            });
        });
    });
  });
});


// Lịch sử đơn hàng
app.get('/order_history', auth_user, cartMiddleware, (req, res) => {
  const website = 'order_history.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems; // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount; // Tổng số tiền giỏ hàng

  // Truy vấn bảng order và tính tổng số lượng hàng theo từng o_id
  const orderQuery = `
    SELECT o.*, 
           COALESCE(SUM(od.quantity), 0) AS total_quantity 
    FROM \`order\` AS o
    LEFT JOIN order_detail AS od ON o.o_id = od.o_id
    WHERE o.user_id = ?
    GROUP BY o.o_id
  `;

  conn.query(orderQuery, [userLogin.userID], (err, orderResults) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    // Truyền dữ liệu order vào view
    res.render('order_history', {
      website,
      userLogin,
      cartItems,
      totalAmount,
      orders: orderResults // Truyền danh sách đơn hàng với tổng số lượng vào view
    });
  });
});


// Đơn hàng chi tiết
app.get('/order_details/:id', auth_user, cartMiddleware, (req, res) => {
  const website = 'order_details.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems; // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount; // Tổng số tiền giỏ hàng
  const o_id = req.params.id;  // Lấy id từ URL

  console.log('Order ID:', o_id);

  // Truy vấn chi tiết đơn hàng và thông tin đơn hàng từ bảng order
  const detailQuery = `
    SELECT 
      od.p_id, od.p_image, od.price, od.quantity, od.p_name,
      o.fullname, o.address, o.delivery, o.total, o.order_date
    FROM order_detail AS od
    JOIN \`order\` AS o ON od.o_id = o.o_id
    WHERE od.o_id = ?
  `;

  conn.query(detailQuery, [o_id], (err, detailResults) => {
    if (err) {
      console.error('Error querying order details:', err);
      return res.status(500).send('Database error');
    }

    // Truyền dữ liệu vào view
    res.render('order_details', {
      website,
      userLogin,
      cartItems,
      totalAmount,
      orderDetails: detailResults, // Truyền chi tiết đơn hàng vào view
      o_id,  // Truyền ID đơn hàng
      fullname: detailResults[0]?.fullname, // Truyền tên người nhận
      address: detailResults[0]?.address,   // Truyền địa chỉ giao hàng
      delivery: detailResults[0]?.delivery, // Truyền phương thức giao hàng
      orderTotal: detailResults[0]?.total,  // Truyền tổng tiền
      orderDate: detailResults[0]?.order_date // Truyền ngày đặt hàng
    });
  });
});

// Route để lấy danh sách sản phẩm và render ra trang
app.get('/Qman_Products', auth_user, cartMiddleware, (req, res) => {
  const website = 'Qman_Products.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng

  const sqlQman = "SELECT * FROM `category` WHERE `provider` = 'Qman'";

  conn.query(sqlQman, (err, results) => {
    if (err) {
      console.error("Error querying database: " + err.stack);
      return res.status(500).send("Database query error");
    }

    // Gán kết quả truy vấn vào mảng categories và render view
    const categories = results.map(category => {
      return {
        id: category.id,
        name: category.name_en,
        images: category.images.split(',').map(img => img.trim()) // Tách chuỗi hình ảnh thành mảng
      };
    });

    // Render view và truyền dữ liệu categories vào EJS
    res.render('Qman_Products', { website, userLogin, cartItems, categories });
  });
});

// Route để lấy danh sách sản phẩm và render ra trang
app.get('/Keeppley_Products', auth_user, cartMiddleware, (req, res) => {
  const website = 'Keeppley_Products.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng

  const sqlKeeppley = "SELECT * FROM `category` WHERE `provider` = 'Keeppley'";

  conn.query(sqlKeeppley, (err, results) => {
    if (err) {
      console.error("Error querying database: " + err.stack);
      return res.status(500).send("Database query error");
    }

    // Gán kết quả truy vấn vào mảng categories và render view
    const categories = results.map(category => {
      return {
        id: category.id,
        name: category.name_en,
        images: category.images.split(',').map(img => img.trim()) // Tách chuỗi hình ảnh thành mảng
      };
    });

    // Render view và truyền dữ liệu categories vào EJS
    res.render('Keeppley_Products', { website, userLogin, cartItems, categories });
  });
});

app.get('/search', auth_user, cartMiddleware, (req, res) => {
  const website = 'search.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;
  const totalAmount = res.locals.totalAmount;

  const keyword = req.query.keyword || '';
  const category = req.query.category || 'all';
  const sortBy = req.query.sortBy || 'price-asc';

  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const sqlCategories = 'SELECT DISTINCT p_category FROM product';
  conn.query(sqlCategories, (err, resultCategories) => {
    if (err) {
      console.error("Error fetching categories: " + err.stack);
      return res.status(500).send("Database query error");
    }

    const sqlCount = 'SELECT COUNT(*) AS total FROM product WHERE p_name_en LIKE ?';
    conn.query(sqlCount, [`%${keyword}%`], (err, resultCount) => {
      if (err) {
        console.error("Error counting products: " + err.stack);
        return res.status(500).send("Database query error");
      }


      let sqlProducts = `
        SELECT *, 
               p_price_en * (1 - (p_discount / 100)) AS discounted_price 
        FROM product 
        WHERE p_name_en LIKE ?`;

      if (category !== 'all') {
        sqlProducts += ` AND p_category = ?`;
      }

      if (sortBy === 'price-asc') {
        sqlProducts += ` ORDER BY discounted_price ASC`;
      } else if (sortBy === 'price-desc') {
        sqlProducts += ` ORDER BY discounted_price DESC`;
      }

      sqlProducts += ` LIMIT ${limit} OFFSET ${offset}`;

      const queryParams = category !== 'all' ? [`%${keyword}%`, category] : [`%${keyword}%`];

      conn.query(sqlProducts, queryParams, (err, resultProducts) => {
        if (err) {
          console.error("Error querying products: " + err.stack);
          return res.status(500).send("Database query error");
        }
        const totalProducts = resultCount.total;
        let totalPages = 1;

        if (totalProducts <= limit) {
          totalPages = 1;
        } else {
          totalPages = Math.ceil(totalProducts / limit);
        }
        res.render('search', {
          website,
          userLogin,
          cartItems,
          totalAmount,
          products: resultProducts,
          currentPage: page,
          totalPages,
          keyword,
          categories: resultCategories,
          category,
          sortBy
        });
      });
    });
  });
});




app.get('/Sidebar', auth_user, cartMiddleware, (req, res) => {
  const website = 'Sidebar.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Sidebar', { website, userLogin, cartItems });
});

app.get('/SocialLinks', auth_user, cartMiddleware, (req, res) => {
  const website = 'SocialLinks.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('SocialLinks', { website, userLogin, cartItems });
});

app.get('/login_again_en', auth_user, cartMiddleware, (req, res) => {
  const website = 'login_again_en.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('login_again_en', { website, userLogin, cartItems });
});

app.get('/logout', (req, res) => {
  // Hủy session
  req.session.destroy((err) => {
    if (err) {
      console.error('Không thể hủy session:', err);
      return res.status(500).send('Có lỗi xảy ra khi logout.');
    }

    // Xóa cookie của session (tùy chọn)
    res.clearCookie('connect.sid'); // 'connect.sid' là tên mặc định của cookie session trong express-session

    // Redirect đến trang đăng nhập hoặc trang chủ sau khi logout
    res.redirect('/');
  });
});



// ----------------------- Admin -------------------------------- //
app.get('/Admin/index', auth_user, cartMiddleware, (req, res) => {
  const website = 'index.ejs';
  const userLogin = res.locals.userLogin

  //Get the actual numbers of order
  const sqlOrder = 'SELECT COUNT(*) AS orderCount FROM `order`';

  conn.query(sqlOrder, (err, results) => {

    if (err) {
      console.error("Error querying users: " + err.stack);
      return res.status(500).send("Database query error");
    }
    // Pass the user count to the EJS template
  const orderCount = results[0].orderCount;

  //Get the actual numbers of user
  const sqlUser = 'SELECT COUNT(*) AS userCount FROM `user`';

  conn.query(sqlUser, (err, results) => {
    if (err) {
      console.error("Error querying users: " + err.stack);
      return res.status(500).send("Database query error");
    }
  
    // Pass the user count to the EJS template
  const userCount = results[0].userCount;

  const sqlProduct = 'SELECT COUNT(*) AS productCount FROM `product`';

  conn.query(sqlProduct, (err, results) => {
    if (err) {
      console.error("Error querying users: " + err.stack);
      return res.status(500).send("Database query error");
    }
  const productCount = results[0].productCount;

  const sqlComment = 'SELECT COUNT(*) AS commentCount FROM `comment`';

  conn.query(sqlComment, (err, results) => {
    if (err) {
      console.error("Error querying users: " + err.stack);
      return res.status(500).send("Database query error");
    }
  
    // Pass the user count to the EJS template
  const commentCount = results[0].commentCount;

  res.render('Admin/index', { website, userLogin, orderCount, userCount, productCount ,commentCount});
      });  
      });
    });
  });
});

app.get('/Admin/addProduct', auth_user, cartMiddleware, (req, res) => {
  const website = 'addProduct.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Admin/addProduct', { website, userLogin, cartItems });
});

app.get('/Admin/addCoupon', auth_user, cartMiddleware, (req, res) => {
  const website = 'addCoupon.ejs';
  const userLogin = res.locals.userLogin;
  res.render('Admin/addCoupon', { website, userLogin });
});
app.post('/Admin/addCoupon', auth_user, async (req, res) => {
  const { nameCoupon, discount, code, validityPeriod, quantity_Coupon, minimum_order } = req.body;
  // Kiểm tra dữ liệu đầu vào
  if (!nameCoupon || !discount || !code || !validityPeriod || !quantity_Coupon || !minimum_order) {
    return res.status(400).send("Missing required fields");
  } const currentDate = new Date();
  const validityDate = new Date(validityPeriod);
  const condition = "active"
  if (quantity_Coupon <= 0 || validityDate < currentDate) {
    condition = 'hidden';
  }
  const sqlAddCoupon = `
    INSERT INTO coupon (nameCoupon, discount, code,\`condition\`, validityPeriod,quantity,minimum)
    VALUES (?, ?, ?,?, ?,?,?)
  `;

  try {
    // Lưu coupon vào cơ sở dữ liệu
    await new Promise((resolve, reject) => {
      conn.query(sqlAddCoupon, [nameCoupon, discount, code, condition, validityPeriod, quantity_Coupon, minimum_order], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    // Redirect về trang danh sách coupon
    res.redirect('/Admin/ManageDiscount');
  } catch (err) {
    console.error("Error adding coupon: ", err);
    res.status(500).send("Error adding coupon");
  }
});

app.get('/Admin/addCategory', auth_user, cartMiddleware, (req, res) => {
  const website = 'addCategory.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Admin/addCategory', { website, userLogin, cartItems });
});

app.get('/Admin/manageUser', auth_user, cartMiddleware, (req, res) => {
  const sql = "SELECT * FROM user";
  const website = 'manageUser.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  conn.query(sql, (error, results) => {
    if (error) throw error;

    const users = results.map(user => ({
      userID: user.userID,
      userName: user.userName,
      email: user.email,
      image: user.image
    }));

    res.render('Admin/manageUser', { website, userLogin, cartItems, users });
  });
});

app.get('/Admin/manageProduct', auth_user, cartMiddleware, (req, res) => {
  const sql = "SELECT * FROM product";
  const website = 'manageProduct.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  conn.query(sql, (error, results) => {
    if (error) throw error;

    const products = results.map(product => ({
      ...product,
      p_image: product.p_image.split(',').map(img => img.trim())
    }));

    res.render('Admin/manageProduct', { website, userLogin, cartItems, products });
  });
});
app.get('/Admin/comment', auth_user, cartMiddleware, (req, res) => {
  const sql = `
    SELECT 
      comment.id, 
      comment.rank, 
      comment.detail, 
      comment.created_at, 
      product.p_name_en AS product_name, 
      user.userName AS user_name
    FROM comment
    JOIN product ON comment.productid = product.p_id
    JOIN user ON comment.userid = user.userID
  `;

  const website = 'comment.ejs';
  const userLogin = res.locals.userLogin;
  conn.query(sql, (error, results) => {
    if (error) throw error;
    const comments = results.map(comment => ({
      ...comment,
      created_at: new Date(comment.created_at).toLocaleString(), // Định dạng ngày
    }));
    console.log('comments', comments)
    res.render('Admin/comment', { website, userLogin, comments });
  });
});

app.get('/deleteComment', auth_user, (req, res) => {
  const commentId = req.query.id;

  // Kiểm tra nếu `commentId` không tồn tại
  if (!commentId) {
    return res.status(400).send('Comment ID is required');
  }

  // Thực hiện xóa comment
  const sql = 'DELETE FROM comment WHERE id = ?';
  conn.query(sql, [commentId], (err, result) => {
    if (err) {
      console.error('Error deleting comment:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (result.affectedRows === 0) {
      return res.status(404).send('Comment not found');
    }

    // Chuyển hướng về trang quản lý comment hoặc thông báo thành công
    res.redirect('/Admin/comment');
  });
});


app.get('/Admin/ManageOrder', auth_user, (req, res) => {
  const website = 'ManageOrder.ejs';
  const userLogin = res.locals.userLogin;

  // Query the order table
  const sql = 'SELECT * FROM `order`';
  conn.query(sql, (err, orders) => {
    if (err) {
      console.error('Error fetching orders:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Format date and time
    const formattedOrders = orders.map(order => {
      const date = new Date(order.order_date);
      return {
        ...order,
        order_date: date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US')
      };
    });

    res.render('Admin/ManageOrder', { website, userLogin, orders: formattedOrders });
  });
});

app.get('/Admin/editOrder', auth_user, (req, res) => {
  const website = 'editOrder.ejs'; // Tên file EJS cho trang chỉnh sửa
  const userLogin = res.locals.userLogin;
  const orderId = req.query.o_id; // Lấy `o_id` từ query string

  // Kiểm tra nếu không có `orderId`
  if (!orderId) {
    return res.status(400).send('Order ID is required');
  }

  // Truy vấn thông tin đơn hàng
  const sql = 'SELECT * FROM `order` WHERE o_id = ?';

  conn.query(sql, [orderId], (err, results) => {
    if (err) {
      console.error('Error fetching order details:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Kiểm tra nếu không tìm thấy đơn hàng
    if (results.length === 0) {
      return res.status(404).send('Order not found');
    }

    const order = results[0];

    // Render trang editOrder với thông tin đơn hàng
    res.render('Admin/editOrder', { website, userLogin, order });
  });
});

// Route để xử lý POST
app.post('/Admin/updateOrder', (req, res) => {
  const { id, o_status } = req.body;

  console.log(id)
  console.log(o_status)
  // Kiểm tra dữ liệu
  if (!id || o_status === undefined) {
    return res.status(400).send('Missing required fields');
  }

  // Câu lệnh SQL để cập nhật trạng thái đơn hàng
  const sql = 'UPDATE `order` SET status = ? WHERE o_id = ?';

  // Thực hiện cập nhật
  conn.query(sql, [o_status, id], (err, result) => {
    if (err) {
      console.error('Error updating order:', err);
      return res.status(500).send('Failed to update order');
    }

    console.log(`Order ${id} updated to status ${o_status}`);
    res.redirect(`/Admin/ManageOrder`); 
  });
});



app.get('/Admin/ManageDiscount', auth_user, cartMiddleware, async (req, res) => {
  const sql = `
  SELECT 
    coupon.id, 
    coupon.nameCoupon, 
    coupon.discount, 
    coupon.code, 
    coupon.quantity,
    coupon.condition, 
    coupon.validityPeriod
  FROM coupon
`;

  const website = 'ManageDiscount.ejs';
  const userLogin = res.locals.userLogin;
  conn.query(sql, (error, results) => {
    if (error) throw error;
    const coupons = results.map(coupon => ({
      ...coupon,
      created_at: new Date(coupon.created_at).toLocaleString(),
      validityPeriod: moment(coupon.validityPeriod).format('YYYY-MM-DD')   // Định dạng ngày
    }));
    res.render('Admin/ManageDiscount', { website, userLogin, coupons });
  });
});

app.get('/Admin/ManageReview', auth_user, cartMiddleware, (req, res) => {
  const website = 'ManageReview.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('Admin/ManageReview', { website, userLogin, cartItems });
});

app.get('/thankyou', auth_user, cartMiddleware, (req, res) => {
  const website = 'thankyou.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('thankyou', { website, userLogin, cartItems });
});

app.get('/contact', auth_user, cartMiddleware, (req, res) => {
  const website = 'contact.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  res.render('contact', { website, userLogin, cartItems });
});

app.get('/coupon', auth_user, cartMiddleware, (req, res) => {
  const website = 'coupon.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware

  // SQL query để lấy các coupon có condition là 'active'
  const sql = `
    SELECT 
      coupon.id, 
      coupon.nameCoupon, 
      coupon.discount, 
      coupon.code, 
      coupon.quantity, 
      coupon.condition, 
      coupon.minimum,
      coupon.validityPeriod
    FROM coupon
    WHERE coupon.condition = 'active'
  `;

  // Thực hiện truy vấn với conn.query
  conn.query(sql, (error, results) => {
    if (error) {
      console.error('Error fetching coupons:', error);
      return res.status(500).send('Error fetching coupons');
    }

    const formattedCoupons = results.map(coupon => ({
      ...coupon,
      created_at: new moment(Date().toLocaleString()).format('YYYY-MM-DD'),
      validityPeriod: moment(coupon.validityPeriod).format('YYYY-MM-DD')  // Định dạng ngày
    }));

    // Render trang coupon.ejs và truyền vào dữ liệu
    res.render('coupon', { website, userLogin, cartItems, coupons: formattedCoupons });
  });
});

app.get('/deleteUser', auth_user, (req, res) => {
  const userID = req.query.id;

  // Kiểm tra nếu `userID` không tồn tại
  if (!userID) {
    return res.status(400).send('User ID is required');
  }

  // Thực hiện xóa user
  const sql = 'DELETE FROM user WHERE userID = ?';
  conn.query(sql, [userID], (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (result.affectedRows === 0) {
      return res.status(404).send('User not found');
    }

    // Chuyển hướng về trang quản lý comment hoặc thông báo thành công
    res.redirect('/Admin/manageUser');
  });
});

app.get('/deleteProduct', auth_user, (req, res) => {
  const productId = req.query.id;

  // Kiểm tra nếu `commentId` không tồn tại
  if (!productId) {
    return res.status(400).send('Product ID is required');
  }

  // Thực hiện xóa comment
  const sql = 'DELETE FROM product WHERE p_id = ?';
  conn.query(sql, [productId], (err, result) => {
    if (err) {
      console.error('Error deleting product:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (result.affectedRows === 0) {
      return res.status(404).send('Product not found');
    }

    // Chuyển hướng về trang quản lý comment hoặc thông báo thành công
    res.redirect('/Admin/manageProduct');
  });
});

app.get('/deleteCoupon', auth_user, (req, res) => {
  const couponId = req.query.id;

  // Kiểm tra nếu `couponId` không tồn tại
  if (!couponId) {
    return res.status(400).send('Coupon ID is required');
  }

  // Thực hiện xóa coupon
  const sql = 'DELETE FROM coupon WHERE id = ?';
  conn.query(sql, [couponId], (err, result) => {
    if (err) {
      console.error('Error deleting coupon:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (result.affectedRows === 0) {
      return res.status(404).send('Coupon not found');
    }

    // Chuyển hướng về trang quản lý coupon hoặc thông báo thành công
    res.redirect('/Admin/ManageDiscount');
  });
});

// Đơn hàng chi tiết
app.get('/Admin/OrderDetails', auth_user, cartMiddleware, (req, res) => {
  const website = 'OrderDetails.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems; // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount; // Tổng số tiền giỏ hàng
  const o_id = req.query.id;  // Lấy ID từ query string

  console.log('Order ID:', o_id);

  // Truy vấn chi tiết đơn hàng và thông tin đơn hàng từ bảng order
  const detailQuery = `
    SELECT 
      od.p_id, od.p_image, od.price, od.quantity, od.p_name,
      o.fullname, o.address, o.delivery, o.total, o.order_date
    FROM order_detail AS od
    JOIN \`order\` AS o ON od.o_id = o.o_id
    WHERE od.o_id = ?
  `;

  conn.query(detailQuery, [o_id], (err, detailResults) => {
    if (err) {
      console.error('Error querying order details:', err);
      return res.status(500).send('Database error');
    }

    // Truyền dữ liệu vào view
    res.render('Admin/OrderDetails', {
      website,
      userLogin,
      cartItems,
      totalAmount,
      orderDetails: detailResults, // Truyền chi tiết đơn hàng vào view
      o_id,  // Truyền ID đơn hàng
      fullname: detailResults[0]?.fullname, // Truyền tên người nhận
      address: detailResults[0]?.address,   // Truyền địa chỉ giao hàng
      delivery: detailResults[0]?.delivery, // Truyền phương thức giao hàng
      orderTotal: detailResults[0]?.total,  // Truyền tổng tiền
      orderDate: detailResults[0]?.order_date // Truyền ngày đặt hàng
    });
  });
});


// Xử lý route POST /contact
app.post('/contact', (req, res) => {
  const website = 'contact.ejs';
  const userLogin = res.locals.userLogin;
  const cartItems = res.locals.cartItems;  // Giỏ hàng đã được truyền vào từ middleware
  const totalAmount = res.locals.totalAmount;  // Tổng số tiền giỏ hàng
  const { name, email, phone, subject, message } = req.body;

  // Chèn dữ liệu vào bảng `contacts`
  const sql = 'INSERT INTO contact (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)';
  const values = [name, email, phone, subject, message];

  conn.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error inserting data into contacts table:', err);
      res.status(500).send('An error occurred while saving your contact.');
      return;
    }
    console.log('Data inserted:', results);
    res.render('thankyou_your_contact', { website, userLogin, cartItems });
  });
});

// Cấu hình cổng để server lắng nghe
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
