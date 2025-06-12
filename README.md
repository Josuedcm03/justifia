composer install

cp .env.example .env
php artisan key:generate

php artisan migrate

php artisan db:seed

php artisan storage:link

npm install
npm run dev

php artisan serve