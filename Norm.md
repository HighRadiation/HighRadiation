# 42 C Norm - Kurallar ve Standartlar

Bu proje, 42 okullarında C projeleri geliştirirken **Norm V4.1** kurallarına tam uyum sağlamak amacıyla hazırlanmıştır.  
Norm, kodun okunabilirliğini, sürdürülebilirliğini ve ekip içinde anlaşılabilirliğini artırmayı hedefleyen bir dizi standart ve öneriden oluşur.

---

## 🔍 Neden Norm Kullanılır?

- **Sıralama:** Kodun mantıklı, adım adım ilerlemesi sağlanır.
- **Görsel Düzen:** Tüm kodlar benzer biçimde göründüğünden, incelemesi ve anlaşılması kolaylaşır.
- **Uzun Vadeli Bakış:** Açık ve anlaşılır kod, ileride bakım ve geliştirme için büyük avantaj sağlar.
- **Referanslar:** Kurallar; rastgele değil, pedagojik ve sektörel prensiplere dayanır.

---

## 📘 Temel Kurallar

### 1. İsimlendirme

- `s_` → struct  
- `t_` → typedef  
- `u_` → union  
- `e_` → enum  
- `g_` → global değişken  
- Tüm isimler yalnızca küçük harf, rakam ve `_` karakteri içermelidir (snake_case).
- Global değişkenler yalnızca `const` veya `static` ise kullanılabilir.

### 2. Biçimlendirme

- Fonksiyonlar en fazla 25 satır olmalı.
- Satırlar en fazla 80 karakter olmalı (tab = 4 boşluk).
- Her blok girintili olmalı, `{` ve `}` tek başına satırda olmalı.
- Boş satırlar boş olmalı, boşluk veya tab içermemeli.
- Bir satırda birden fazla işlem yapılmamalı.

### 3. Fonksiyonlar

- En fazla 4 parametre alabilir.
- En fazla 5 yerel değişken tanımlanabilir.
- `return` ifadesi parantez içinde yazılmalı (`return (val);`).
- Parametreler isimli olmalı.

### 4. Header Dosyaları

- Sadece `#define`, prototip, struct, enum, union ve macro içerebilir.
- Çift dahil etmeyi önleyici tanım (`#ifndef ...`) zorunludur.
- Header içinde `.c` dosyası `#include` edilemez.

### 5. Yasaklanan Yapılar

- Döngüde `for`, `do...while`, `switch`, `goto`, ternary (`?`) operatörü, VLA ve tür belirtmeden değişken tanımı yasaktır.
- Fonksiyon içinde satır içi açıklamalar dışında yorum satırı yasaktır.

### 6. Dosya Organizasyonu

- Bir `.c` dosyasında en fazla 5 fonksiyon tanımı olabilir.
- `.c` dosyaları birbirini `#include` edemez.

### 7. Makefile Kuralları

- `NAME`, `all`, `clean`, `fclean`, `re` hedefleri zorunludur.
- `all` varsayılan hedef olmalı.
- Gereksiz yeniden derleme yapılmamalıdır.
- Joker karakter (`*.c`, `*.o`) kullanılmamalı, dosyalar tek tek listelenmelidir.

---

## 🛠 Norminette

Norminette, bu kurallara uygunluk kontrolü yapan Python tabanlı bir doğrulama aracıdır.  
GitHub adresi: [https://github.com/42School/norminette](https://github.com/42School/norminette)

---

## ⚠️ Uyarılar

- Kodun düzgün görünmesi ve herkes tarafından anlaşılması için bu kurallara uymak **zorunludur**.
- Norm kurallarına uymayan kodlar projede **başarısız** sayılabilir.

---

## Lisans

Bu proje 42 okullarındaki genel C Norm standartlarını referans alır. Ek olarak, [Norminette](https://github.com/42School/norminette) aracı ile uyumludur.
